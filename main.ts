import { App, Editor, Plugin, PluginSettingTab, Setting, Notice, MarkdownView } from 'obsidian';
import { ChatCompletionFunctions, ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum, Configuration, CreateChatCompletionResponse, OpenAIApi } from "openai";
import { InternalBrowser } from 'plugins/browser/browser';

// Remember to rename these classes and interfaces!

interface AIToolsSettings {
	openaiAPIKey: string;
	randomness: number;
	model: string;
	chatMessagesSeparator: string;
	searchAndBrowse: boolean;
	googleSearchCX: string;
	googleSearchKey: string;
}

const NEW_LINE = "\n\n";
const LINE_SEP = "---";
const H1 = "# ";
let MODELS = ["gpt-3.5-turbo", "gpt-3.5-turbo-16k"]

const DEFAULT_SETTINGS: AIToolsSettings = {
	openaiAPIKey: '',
	randomness: 1,
	model: "gpt-3.5-turbo",
	chatMessagesSeparator: LINE_SEP,
	searchAndBrowse: false,
	googleSearchCX: "",
	googleSearchKey: ""
}

export default class AITools extends Plugin {
	settings: AIToolsSettings;

	functions: ChatCompletionFunctions[] = []

	internalBrowser: InternalBrowser

	statusBar: HTMLElement

	async onload() {

		this.statusBar = this.addStatusBarItem();

		await this.loadSettings();

		MODELS = await this.getAvailableModels();

		this.updateStatusBar();

		this.addRibbonIcon("dice", "Switch Model", async () => {
			const currentModelIndex = MODELS.indexOf(this.settings.model)
			this.settings.model = MODELS[(currentModelIndex+1)%MODELS.length]
			await this.saveSettings()
			this.updateStatusBar()
		});

		this.addRibbonIcon("bot", "Complete current chat", async () => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if(view){
				this.getChatCompletion(view.editor)
			}
		});

		this.addRibbonIcon("message-square-plus", "Create chat message", () => {
			this.createNewChat();	
		});

		/** @todo make it dynamically go and fetch all internal plugins*/
		if(this.settings.searchAndBrowse) {
			this.internalBrowser = new InternalBrowser(this);
			this.functions = this.functions.concat(this.internalBrowser.funcs());
		}
		// This adds the use selection as prompt
		this.addCommand({
			id: 'ai-tools-selection-as-prompt',
			name: 'Use Selection as Prompt',
			editorCallback: async (editor: Editor) => {
				const notice = new Notice("AI Tools -> Processing...");
				await this.selectionAsPrompt(editor)
				notice.hide();
			}
		});

		// This completes the current chat
		this.addCommand({
			id: 'ai-tools-complete-chat',
			name: 'Complete the current chat',
			editorCallback: async (editor: Editor) => {
				await this.getChatCompletion(editor)
			}
		});

		// Creates a new chat
		this.addCommand({
			id: 'ai-tools-create-chat',
			name: 'Create a new chat in the current note',
			editorCallback: async (editor: Editor) => {
				this.createNewChat();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AIToolsSettingsTab(this.app, this));
	}

	onunload() {

	}

	async getAvailableModels(): Promise<string[]> {
		const models = await this.loadOpenAI().listModels()
		return models.data.data.flatMap((model) => {
			if(model.id.toLowerCase().contains("gpt")){
				return [model.id];
			} else {
				return [];
			}
		})
	}

	updateStatusBar(){
		this.statusBar.firstChild?.remove();
		this.statusBar.createEl("span", { text: `OpenAI Model: ${this.settings.model}`});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async selectionAsPrompt(editor: Editor): Promise<undefined> {
		const prompt = editor.getSelection();
		const editorSelection = editor.listSelections().first();

		const openai = this.loadOpenAI();
		const response = await openai.createChatCompletion({
			model: this.settings.model,
			messages: [{ role: "user", content: prompt }],
		});
		const results = response.data.choices.first()?.message?.content
		if(results && editorSelection){
			const line = editorSelection.anchor.line > editorSelection.head.line ? editorSelection.anchor.line : editorSelection.head.line; 
			editor.replaceRange(NEW_LINE + LINE_SEP + NEW_LINE + results, { line: line+1, ch: 0 })
		}
		return new Promise(() => {return undefined})
	}

	async handleFunctionCall(previousResponse: CreateChatCompletionResponse, editor: Editor): Promise<undefined> {
		const choice = previousResponse.choices.first();
		const functionCall = choice?.message?.function_call

		if (functionCall && functionCall.name) {
			/** @todo make this more dynamic in case we have more plugins **/
			let functionResponse;
			if (functionCall.name == "googleSearch") {
				functionResponse = await this.internalBrowser.googleSearch(functionCall)
			} else if (functionCall.name == "getWebpage") {
				functionResponse = await this.internalBrowser.getWebpage(functionCall)
			}
			if (functionResponse) {
				const lineCount = editor.lineCount();
				editor.replaceRange(this.buildMessage("function:" + functionCall.name, functionResponse), { line: lineCount, ch: 0 })
			}
		} else {
			return new Promise(() => { return undefined });
		}
	}

	private getMessages(content: string): ChatCompletionRequestMessage[] {
		return content.split(this.settings.chatMessagesSeparator).flatMap((message) => {
			const messageLines = message.split(NEW_LINE);
			const indexOfRoleLine = messageLines.findIndex((e) => e.startsWith(H1));
			const roleLine = messageLines[indexOfRoleLine]?.trim().toLowerCase();
			if (!roleLine) {
				return []
			}
			const roleStr: string = roleLine.split(H1)[1];
			const role = roleStr;
			const content: string = messageLines.slice(indexOfRoleLine+1).join(NEW_LINE).trim();
			const out: ChatCompletionRequestMessage[] = []
			if(role.startsWith("function")){
				const roleSplit = role.split(":");
				out.push({ role: roleSplit[0] as ChatCompletionRequestMessageRoleEnum, name: roleSplit[1], content: content})
			} else {
				out.push({ role: role as ChatCompletionRequestMessageRoleEnum, content: content })
			}
			return out;
		})
	}

	async getChatCompletion(editor: Editor, loops = 0): Promise<undefined> {
		const notice = new Notice("AI Tools -> Processing...", 0);
		let content;
		let line: number;
		if(editor.somethingSelected()){
			const editorSelection = editor.listSelections().first();
			line = editorSelection.anchor.line > editorSelection.head.line ? editorSelection.anchor.line + 1 : editorSelection.head.line + 1;
			content = editor.getSelection();
		} else {
			content = editor.getValue();
			line = editor.lineCount();
		}
		const messages = this.getMessages(content);
		const openai = this.loadOpenAI();
		const request: any = {
			model: this.settings.model,
			messages: messages
		};

		if(this.settings.searchAndBrowse && this.functions.length > 0) {
			request.functions = this.functions
		}

		const response = await openai.createChatCompletion(request).catch(reason => {
			console.error(reason.response);
			const message = this.buildMessage("PluginError", JSON.stringify(reason.response.data))
			editor.replaceRange(message, { line: line, ch: 0 })
			notice.hide();
			return false;
		});

		if(!response) {
			notice.hide();
		}

		if (typeof response != "boolean") {
			const choice = response.data.choices.first();
			if (choice && choice.message) {
			const message = choice.message;
				if (message?.function_call) {
					const editorOutput = this.buildMessage("assistant", JSON.stringify(message.function_call));
					editor.replaceRange(editorOutput, { line: line, ch: 0 })
					await this.handleFunctionCall(response.data, editor);
					if (loops < 5) {
						await this.getChatCompletion(editor, loops + 1);
					}
				} else if (message.content) {
					const editorOutput = this.buildMessage("assistant", message.content);
					editor.replaceRange(editorOutput, { line: line, ch: 0 })
				}
				notice.hide();
			}
		}
		notice.hide();
		return new Promise(() => {});
	}

	private createNewChat() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const lineCount = view?.editor.lineCount();
		const message = []
		if (lineCount) {
			if (lineCount > 1) {
				message.push(NEW_LINE)
				message.push(this.settings.chatMessagesSeparator)
				message.push(NEW_LINE)
			}
			message.push(H1 + 'User')
			message.push(NEW_LINE)
			view?.editor.replaceRange(message.join(''), { line: lineCount, ch: 0 })
			view?.editor.setCursor(view.editor.lineCount());
			view?.editor.focus();
		}
	}

	private buildMessage(role: string, message: string): string {
		return NEW_LINE
			+ this.settings.chatMessagesSeparator
			+ NEW_LINE
			+ H1 + role 
			+ NEW_LINE
			+ message
	}

	loadOpenAI() {
		const configuration = new Configuration({
			apiKey: this.settings.openaiAPIKey,
		});
		return new OpenAIApi(configuration);
	}
}

class AIToolsSettingsTab extends PluginSettingTab {
	plugin: AITools;

	constructor(app: App, plugin: AITools) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'General Settings' });

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('Enter your OpenAI API Key here. This key is required to enable the AI functionalities of the plugin.')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.openaiAPIKey)
				.onChange(async (value) => {
					this.plugin.settings.openaiAPIKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
		.setName('Model Used')
		.setDesc('Which openai model to use to fully the commands.')
			.addDropdown(dd => {
				MODELS.forEach(model => {
					dd.addOption(model, model)
				})
				dd.setValue(this.plugin.settings.model)
				dd.onChange(async (value) => {
					this.plugin.settings.model = value
					await this.plugin.saveSettings();
				})
		})

		new Setting(containerEl)
			.setName('Model Randomness (Temperature)')
			.setDesc("Adjust the randomness of the AI model's responses. A lower value (closer to 0) makes the output more deterministic and focused, while a higher value (up to 2) increases creativity and diversity in the output.")
			.addSlider(slider =>
				slider.setLimits(0, 2, 0.1)
					.setValue(this.plugin.settings.randomness)
					.onChange(async (value) => {
						this.plugin.settings.randomness = value;
						await this.plugin.saveSettings();
					}).setDynamicTooltip());


		containerEl.createEl('h2', { text: 'Google Custom Search settings' });

		new Setting(containerEl)
		.setName('Enable Search & Browse')
		.setDesc('Enable the search google and browse website capabilities')
		.addToggle(toggle =>
			toggle.setValue(this.plugin.settings.searchAndBrowse)
			.onChange(async(value) => {
				this.plugin.settings.searchAndBrowse = value;
				if(value) {
					this.plugin.internalBrowser = new InternalBrowser(this.plugin);
					this.plugin.functions = this.plugin.functions.concat(this.plugin.internalBrowser.funcs());
				} else {
					this.plugin.functions = [];
				}

				await this.plugin.saveSettings();
			})
		);

		new Setting(containerEl)
		.setName('Search Engine ID (CX)')
		.setDesc('The search engine id from the Google programmable search engine dashboard.')
		.addText(text => 
			text.setPlaceholder('')
			.setValue(this.plugin.settings.googleSearchCX)
			.onChange(async(value) => {
				this.plugin.settings.googleSearchCX = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
		.setName('Search Engine Key')
		.setDesc('The search engine secret key from the Google programmable search engine dashboard.')
		.addText(text => 
			text.setPlaceholder('')
			.setValue(this.plugin.settings.googleSearchKey)
			.onChange(async(value) => {
				this.plugin.settings.googleSearchKey = value;
				await this.plugin.saveSettings();
			}));
	}
}
