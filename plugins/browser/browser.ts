import { Notice, requestUrl } from "obsidian"
import { ChatCompletionFunctions, ChatCompletionRequestMessageFunctionCall, OpenAIApi } from "openai"

export class InternalBrowser {

	static BROWSE_URL = "http://localhost:80/chat-gpt/browse.php"

	static async getWebpage(openai: OpenAIApi, params: ChatCompletionRequestMessageFunctionCall): Promise<string> {
		const paramsParsed = JSON.parse(params.arguments)
		const notice = new Notice("AI Tools -> Scraping " + paramsParsed.url, 0);
		const request = await requestUrl({
			url: this.BROWSE_URL,
			contentType: "Content-Type: application/json",
			body: params.arguments,
			method: "POST"
		})
		const text = request.text;
		notice.hide();
		return text
	}

	static funcs(): ChatCompletionFunctions[] {
		return [
			{
				name: "getWebpage",
				description: "Retrieve a webpage's specific chunk/part by URL and chunk number. Response includes chunk content and remaining available chunks.",
				parameters: {
					type: "object",
					properties: {
						url: {
							type: "string",
							description: "The URL of the webpage to fetch the HTML from."
						},
						chunk: {
							type: "integer",
							description: "The specific chunk or part of the webpage content to retrieve. It is required and starts at 0."
						}
					},
					required: [
						"url",
						"chunk"
					]
				}
			},
			{
				name: "googleSearch",
				description: "Given a keyword passed in the requestBody tries to find the urls matching that keyword",
				parameters: {
					type: "object",
					properties: {
						keyword: {
							type: "string",
							description: "The keyword to search with for potential URLs."
						}
					},
					required: [
						"keyword"
					]
				}
			}
		]
	}
}
