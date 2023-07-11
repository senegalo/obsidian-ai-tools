# AI Tools for Obsidian

AI Tools is a robust plugin for Obsidian, utilizing the power of OpenAI's gpt-3.5-turbo to enhance your note-taking and knowledge management experience. The plugin offers a set of commands that use custom prompts to perform various tasks, currently featuring two commands: "Summarize Note" and "Summarize Selection".

## Features

- **Summarize Note**: This command allows you to generate a concise summary of the entire note. It's perfect for quickly grasping the main points of lengthy or complex notes.

- **Summarize Selection**: This command enables you to create a summary of a specific text selection within your note. Ideal for focusing on key details in a particular section or paragraph.

- **Use Selection As Prompt**: This command enables you to use a specific text selection within your note as an input prompt to the model.

- **Customizable Settings**: You can customize the behavior of the AI model by setting the API key and the "temperature" of the model in the plugin settings. The temperature parameter controls the randomness of the AI's output: a value of 0 makes the output deterministic and consistent, while a value of 2 makes the output highly diverse and unpredictable.

## Installation

1. In Obsidian, open Settings > Third-party plugin
2. Disable Safe mode
3. Click Browse community plugins
4. Search for "AI Tools"
5. Click Install
6. After installation, activate the plugin in Settings > Third-party plugins

## Usage

After installation and activation, you can use the "Summarize Note", "Summarize Selection" and "Use Selection as Prompt" commands by:

1. Opening the command palette with `Ctrl+P` (or `Cmd+P` on macOS)
2. Typing the command name and hitting `Enter`

## Configuration

To configure the plugin:

1. Go to Settings > Third-party plugins > AI Tools

### General Settings

- **OpenAI API Key**: Enter your OpenAI API Key here. This key is required to enable the AI functionalities of the plugin.
- **Model Randomness (Temperature)**: Adjust the randomness of the AI model's responses. A lower value (closer to 0) makes the output more deterministic and focused, while a higher value (up to 2) increases creativity and diversity in the output.

### Summarization Settings

- **Summarization Prompt**: Define the prompt that is sent along with the text for summarization. This prompt guides the AI in generating the summary.
- **Summary Prefix**: Specify a prefix that will be added before the summary result. This can be used to clearly indicate the start of the AI-generated summary.

## Contributing

This plugin is open source and contributions are welcome. Feel free to fork the repository, make your changes, and submit a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This plugin uses OpenAI's gpt-3.5-turbo, which may incur costs on your OpenAI account. Please use responsibly and be aware of OpenAI's pricing details.

## Support

If you encounter any problems or have suggestions, please open an issue on the GitHub repository.

## Developer Notes

### First time developing plugins?

Quick starting guide for new plugin devs:

- Check if [someone already developed a plugin for what you want](https://obsidian.md/plugins)! There might be an existing plugin similar enough that you can partner up with.
- Make a copy of this repo as a template with the "Use this template" button (login to GitHub if you don't see it).
- Clone your repo to a local development folder. For convenience, you can place this folder in your `.obsidian/plugins/your-plugin-name` folder.
- Install NodeJS, then run `npm i` in the command line under your repo folder.
- Run `npm run dev` to compile your plugin from `main.ts` to `main.js`.
- Make changes to `main.ts` (or create new `.ts` files). Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.
- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

### Releasing new releases

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases
- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments. Note: The manifest.json file must be in two places, first the root path of your repository and also in the release.
- Publish the release.

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

### Manually installing the plugin
- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

### Improve code quality with eslint (optional)
- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code. 
- To use eslint with this project, make sure to install eslint from terminal:
  - `npm install -g eslint`
- To use eslint to analyze this project use this command:
  - `eslint main.ts`
  - eslint will then create a report with suggestions for code improvement by file and line number.
- If your source code is in a folder, such as `src`, you can use eslint with this command to analyze all files in that folder:
  - `eslint .\src\`

---

Enjoy using AI Tools for Obsidian!
