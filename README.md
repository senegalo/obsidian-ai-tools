# AI Tools for Obsidian

AI Tools is a powerful plugin for Obsidian, leveraging the capabilities of OpenAI's gpt-3.5-turbo to enhance your note-taking and knowledge management experience. The plugin offers a set of commands that use custom prompts to perform various tasks, currently featuring a "Summarize Note" command that condenses your notes into concise bullet points.

## Features

- **Summarize Note**: This command takes the entire content of a note and uses the power of gpt-3.5-turbo to summarize it into digestible bullet points. This is particularly useful for quickly understanding the key points of lengthy or complex notes.

- **Customizable Settings**: You can customize the behavior of the AI model by setting the API key and the "temperature" of the model in the plugin settings. The temperature parameter controls the randomness of the AI's output: a value of 0 makes the output deterministic and consistent, while a value of 2 makes the output highly diverse and unpredictable.

## Installation

1. In Obsidian, open Settings > Third-party plugin
2. Disable Safe mode
3. Click Browse community plugins
4. Search for "AI Tools"
5. Click Install
6. After installation, activate the plugin in Settings > Third-party plugins

## Usage

After installation and activation, you can use the "Summarize Note" command by:

1. Opening the command palette with `Ctrl+P` (or `Cmd+P` on macOS)
2. Typing "Summarize Note" and hitting `Enter`

## Configuration

To configure the plugin:

1. Go to Settings > Third-party plugins > AI Tools
2. Enter your OpenAI API key
3. Set the temperature parameter as per your preference

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
