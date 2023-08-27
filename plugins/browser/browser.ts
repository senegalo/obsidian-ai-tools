import AITools from "main";
import { Notice, requestUrl } from "obsidian"
import { ChatCompletionFunctions, ChatCompletionRequestMessageFunctionCall} from "openai"
import { URLSearchParams } from "url";



export type SearchResponse = {
	title: string;
	link: string;
	snippet: string;
}


export class InternalBrowser {

	static BROWSE_URL = "http://localhost:80/chat-gpt/browse.php"
	
	mainPlugin: AITools

	constructor(mainPlugin: AITools) {
		this.mainPlugin = mainPlugin;
	}

	async getWebpage(params: ChatCompletionRequestMessageFunctionCall): Promise<string> {
		
		if(!params.arguments){
			return new Promise(() => "");
		}

		const paramsParsed = JSON.parse(params.arguments)
		const notice = new Notice("AI Tools -> Scraping " + paramsParsed.url, 0);
		const request = await requestUrl({
			url: InternalBrowser.BROWSE_URL,
			contentType: "Content-Type: application/json",
			body: params.arguments,
			method: "POST"
		})
		const text = request.text;
		notice.hide();
		return text
	}

	async googleSearch(params:ChatCompletionRequestMessageFunctionCall): Promise<string>{
		if (!params.arguments) {
			return new Promise(() => "");
		}
		const paramsParsed = JSON.parse(params.arguments)
		const notice = new Notice(`AI Tools -> Searching using keyword: ${paramsParsed.keyword}`, 0);
		const url = new URL('https://customsearch.googleapis.com/customsearch/v1');
		const searchParams = new URLSearchParams();
		searchParams.set("cx", this.mainPlugin.settings.googleSearchCX)
		searchParams.set("q", paramsParsed.keyword)
		searchParams.set("key", this.mainPlugin.settings.googleSearchKey);
		url.search = searchParams.toString();
		const request = await requestUrl({
			url: url.toString(),
			method: "GET",
			headers: {"Accept": "application/json"}
		})
		const results: {items: SearchResponse[]} = request.json
		const out: SearchResponse[] = [];
		results.items.forEach(element => {
			const result = {
				title: element.title,
				link: element.link,
				snippet: element.snippet
			}
			out.push(result);
		});
		notice.hide();
		return JSON.stringify(out);
	}

	funcs(): ChatCompletionFunctions[] {
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
