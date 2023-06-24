import { App, Editor, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Configuration, OpenAIApi } from "openai";

// Remember to rename these classes and interfaces!

interface AIToolsSettings {
	openaiAPIKey: string;
	randomness: number
}

const DEFAULT_SETTINGS: AIToolsSettings = {
	openaiAPIKey: '',
	randomness: 1
}

export default class MyPlugin extends Plugin {
	settings: AIToolsSettings;

	async onload() {
		await this.loadSettings();

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'ai-summarise-note',
			name: 'Summarise a Note using AI',
			editorCallback: async (editor: Editor) => {
				const summary = await this.summarize(editor.getValue())
				const lineCount = editor.lineCount();
				console.log(summary);
				editor.replaceRange(summary, {line: lineCount, ch: 0})
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
		const prompt = "summarize the following notes into a series of points. The output format should just be summary in markdown format: \n" + content;
		const openai = this.loadOpenAI();
		return openai.createChatCompletion({
			model: "gpt-3.5-turbo",
			messages: [{ role: "user", content: prompt }],
		}).then((r) => {
			console.log(r);
			return "\n\n---\n\n## Summary\n\n"+r.data.choices.first()?.message?.content
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

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Openai API Token')
			.setDesc('OpenAI API Token from the settings')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.openaiAPIKey)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.openaiAPIKey= value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('Radmoness of resrultes (temprature)')
			.setDesc('The reandomess of the repeated similar prompts')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.openaiAPIKey)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.openaiAPIKey= value;
					await this.plugin.saveSettings();
				}));
	}
}
