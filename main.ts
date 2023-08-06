import { App, Editor, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import { ChatCompletionFunctions, ChatCompletionRequestMessage, ChatCompletionResponseMessage, Configuration, CreateChatCompletionResponse, OpenAIApi } from "openai";
import { InternalBrowser } from 'plugins/browser/browser';

// Remember to rename these classes and interfaces!

interface AIToolsSettings {
	openaiAPIKey: string;
	randomness: number;
	summarizePrompt: string;
	summaryResultPrefix: string;
	model: string;
	chatMessagesSeparator: string;
}

type APIChatCompleteionResponse = {
	output: string;
	response: CreateChatCompletionResponse
}

const NEW_LINE = "\n\n";
const LINE_SEP = "---";
const H1 = "# ";

const DEFAULT_SETTINGS: AIToolsSettings = {
	openaiAPIKey: '',
	randomness: 1,
	summarizePrompt: "summarize the following notes into a series of points. The output format should just be summary in markdown format without any titles of prefixes:",
	summaryResultPrefix: NEW_LINE + LINE_SEP + NEW_LINE + H1 + "Summary" + NEW_LINE,
	model: "gpt-3.5-turbo",
	chatMessagesSeparator: LINE_SEP
}

export default class MyPlugin extends Plugin {
	settings: AIToolsSettings;

	functions: ChatCompletionFunctions[] = []

	async onload() {
		await this.loadSettings();

		/** @todo make it dynamically go and fetch all internal plugins*/
		this.functions = this.functions.concat(InternalBrowser.funcs());

		console.log(this.functions);
		

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
				const notice = new Notice("AI Tools -> Processing...", 0);
				await this.getChatCompletion(editor)
				notice.hide();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AIToolsSettingsTab(this.app, this));
	}

	onunload() {

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

		const openai = this.loadOpenAI();

		/** @todo make this more dynamic in case we have more plugins **/
		const functionResponse = await InternalBrowser[functionCall.name](openai, functionCall)

		const lineCount = editor.lineCount();
		editor.replaceRange(this.buildMessage("function:"+functionCall.name, functionResponse), { line: lineCount, ch: 0 })
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
			if(role.startsWith("function")){
				const roleSplit = role.split(":");
				return [{ role: roleSplit[0], name: roleSplit[1], content: content}]
			} else {
				return [{ role: role, content: content }]
			}
		})
	}

	async getChatCompletion(editor: Editor, loops = 0): Promise<undefined> {
		const content = editor.getValue();
		const messages = this.getMessages(content);
		const openai = this.loadOpenAI();

		const response = await openai.createChatCompletion({
			model: this.settings.model,
			messages: messages,
			functions: this.functions
		});

		const choice = response.data.choices.first();

		const lineCount = editor.lineCount();
		const message = choice?.message;

		if (message?.function_call) {
			const editorOutput = this.buildMessage("assistant", JSON.stringify(message.function_call));
			editor.replaceRange(editorOutput, { line: lineCount, ch: 0 })
			await this.handleFunctionCall(response.data, editor);
			if(loops < 5){
				await this.getChatCompletion(editor, loops+1);
			}
		} else {
			const editorOutput = this.buildMessage("assistant", message?.content);
			editor.replaceRange(editorOutput , { line: lineCount, ch: 0 })
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
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
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
			.setName('Model Randomness (Temperature)')
			.setDesc("Adjust the randomness of the AI model's responses. A lower value (closer to 0) makes the output more deterministic and focused, while a higher value (up to 2) increases creativity and diversity in the output.")
			.addSlider(slider =>
				slider.setLimits(0, 2, 0.1)
					.setValue(this.plugin.settings.randomness)
					.onChange(async (value) => {
						this.plugin.settings.randomness = value;
						await this.plugin.saveSettings();
					}).setDynamicTooltip());

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
