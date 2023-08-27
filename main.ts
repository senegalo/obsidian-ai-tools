import { create } from 'domain';
import { App, Editor, Plugin, PluginSettingTab, Setting, Notice, MarkdownView } from 'obsidian';
import { ChatCompletionFunctions, ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum, ChatCompletionResponseMessage, Configuration, CreateChatCompletionResponse, OpenAIApi } from "openai";
import { InternalBrowser } from 'plugins/browser/browser';

// Remember to rename these classes and interfaces!

interface AIToolsSettings {
	openaiAPIKey: string;
	randomness: number;
	summarizePrompt: string;
	summaryResultPrefix: string;
	model: string;
	chatMessagesSeparator: string;
	googleSearchCX: string;
	googleSearchKey: string;
}

const NEW_LINE = "\n\n";
const LINE_SEP = "---";
const H1 = "# ";
const MODELS = ["gpt-3.5-turbo", "gpt-3.5-turbo-16k"]

const DEFAULT_SETTINGS: AIToolsSettings = {
	openaiAPIKey: '',
	randomness: 1,
	summarizePrompt: "summarize the following notes into a series of points. The output format should just be summary in markdown format without any titles of prefixes:",
	summaryResultPrefix: NEW_LINE + LINE_SEP + NEW_LINE + H1 + "Summary" + NEW_LINE,
	model: "gpt-3.5-turbo",
	chatMessagesSeparator: LINE_SEP,
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
		
		//this.internalBrowser = new InternalBrowser(this);
		//this.functions = this.functions.concat(this.internalBrowser.funcs());

		// This adds the summarize whole note 
		this.addCommand({
			id: 'ai-tools-summarize-note',
			name: 'Summarize Note',
			editorCallback: async (editor: Editor) => {
				const notice = new Notice("AI Tools -> Summarizing...");
				const summary = await this.summarize(editor.getValue())
				const lineCount = editor.lineCount();
				editor.replaceRange(summary, { line: lineCount, ch: 0 })
				notice.hide();
			}
		});

		// This adds the summarize selection
		this.addCommand({
			id: 'ai-tools-summarize-selection',
			name: 'Summarize Selection',
			editorCallback: async (editor: Editor) => {
				const notice = new Notice("AI Tools -> Summarizing...");
				const summary = await this.summarize(editor.getSelection())
				const lineCount = editor.lineCount();
				editor.replaceRange(summary, { line: lineCount, ch: 0 })
				notice.hide();
			}
		});

		// This adds the use selection as prompt
		this.addCommand({
			id: 'ai-tools-selection-as-prompt',
			name: 'Use Selection as Prompt',
			editorCallback: async (editor: Editor) => {
				const notice = new Notice("AI Tools -> Processing...");
				const result = await this.selectionAsPrompt(editor.getSelection())
				const lineCount = editor.lineCount();
				editor.replaceRange(result, { line: lineCount, ch: 0 })
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
			editorCallback: (editor: Editor) => {
				this.createNewChat();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AIToolsSettingsTab(this.app, this));
	}

	onunload() {

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

	async summarize(content: string): Promise<string> {
		const prompt = this.settings.summarizePrompt + "\n" + content;

		const openai = this.loadOpenAI();
		return await openai.createChatCompletion({
			model: this.settings.model,
			messages: [{ role: "user", content: prompt }],
		}).then((r) => {
			return this.settings.summaryResultPrefix + r.data.choices.first()?.message?.content
		}).catch(e => {
			console.error(e);
			return "";
		});
	}

	async selectionAsPrompt(content: string): Promise<string> {
		const prompt = content;

		const openai = this.loadOpenAI();
		return await openai.createChatCompletion({
			model: this.settings.model,
			messages: [{ role: "user", content: prompt }],
		}).then((r) => {
			return this.settings.summaryResultPrefix + r.data.choices.first()?.message?.content
		}).catch(e => {
			console.error(e);
			return "";
		});
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
		const content = editor.getValue();
		const messages = this.getMessages(content);
		const openai = this.loadOpenAI();
		const lineCount = editor.lineCount();

		const response = await openai.createChatCompletion({
			model: this.settings.model,
			messages: messages,
			//functions: this.functions
		}).catch(reason => {
			console.error(reason.response);
			const message = this.buildMessage("PluginError", JSON.stringify(reason.response.data))
			editor.replaceRange(message, { line: lineCount, ch: 0 })
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
					editor.replaceRange(editorOutput, { line: lineCount, ch: 0 })
					await this.handleFunctionCall(response.data, editor);
					if (loops < 5) {
						await this.getChatCompletion(editor, loops + 1);
					}
				} else if (message.content) {
					const editorOutput = this.buildMessage("assistant", message.content);
					editor.replaceRange(editorOutput, { line: lineCount, ch: 0 })
				}
				notice.hide();
			}
		}
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

		containerEl.createEl('h2', { text: 'Summarization Settings' });

		new Setting(containerEl)
			.setName('Summarization Prompt')
			.setDesc('Define the prompt that is sent along with the text for summarization. This prompt guides the AI in generating the summary.')
			.addTextArea(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.summarizePrompt)
				.onChange(async (value) => {
					this.plugin.settings.summarizePrompt = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Summary Prefix')
			.setDesc('Specify a prefix that will be added before the summary result. This can be used to clearly indicate the start of the AI-generated summary.')
			.addTextArea(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.summaryResultPrefix)
				.onChange(async (value) => {
					this.plugin.settings.summaryResultPrefix = value;
					await this.plugin.saveSettings();
				}));
	}
}
