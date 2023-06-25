import { App, Editor, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Configuration, OpenAIApi } from "openai";

// Remember to rename these classes and interfaces!

interface AIToolsSettings {
	openaiAPIKey: string;
	randomness: number;
	summarizePrompt: string;
	summaryResultPrefix: string;
}

const DEFAULT_SETTINGS: AIToolsSettings = {
	openaiAPIKey: '',
	randomness: 1,
	summarizePrompt: "summarize the following notes into a series of points. The output format should just be summary in markdown format:",
	summaryResultPrefix: "\n\n---\n\n## Summary\n\n"
}

export default class MyPlugin extends Plugin {
	settings: AIToolsSettings;

	async onload() {
		await this.loadSettings();

		// This adds the summarize whole note 
		this.addCommand({
			id: 'ai-tools-summarize-note',
			name: 'Summarize Note',
			editorCallback: async (editor: Editor) => {
				const summary = await this.summarize(editor.getValue())
				const lineCount = editor.lineCount();
				editor.replaceRange(summary, {line: lineCount, ch: 0})
			}
		});

		// This adds the summarize selection
		this.addCommand({
			id: 'ai-tools-summarize-selection',
			name: 'Summarize Selection',
			editorCallback: async (editor: Editor) => {
				const summary = await this.summarize(editor.getSelection())
				const lineCount = editor.lineCount();
				editor.replaceRange(summary, { line: lineCount, ch: 0 })
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
		return openai.createChatCompletion({
			model: "gpt-3.5-turbo",
			messages: [{ role: "user", content: prompt }],
		}).then((r) => {
			return this.settings.summaryResultPrefix+r.data.choices.first()?.message?.content
		}).catch(e => {
			console.error(e);
			return "";
		});
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
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'General Settings'});

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('Enter your OpenAI API Key here. This key is required to enable the AI functionalities of the plugin.')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.openaiAPIKey)
				.onChange(async (value) => {
					this.plugin.settings.openaiAPIKey= value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('Model Randomness (Temperature)')
			.setDesc("Adjust the randomness of the AI model's responses. A lower value (closer to 0) makes the output more deterministic and focused, while a higher value (up to 2) increases creativity and diversity in the output.")
			.addSlider(slider => 
				slider.setLimits(0, 2, 0.1)
				.setValue(this.plugin.settings.randomness)
				.onChange(async(value) => {
					this.plugin.settings.randomness = value;
					await this.plugin.saveSettings();
				}).setDynamicTooltip());

		containerEl.createEl('h2', {text: 'Summarization Settings'});

		new Setting(containerEl)
			.setName('Summarization Prompt')
			.setDesc('Define the prompt that is sent along with the text for summarization. This prompt guides the AI in generating the summary.')
			.addTextArea(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.summarizePrompt)
				.onChange(async (value) => {
					this.plugin.settings.summarizePrompt= value;
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
