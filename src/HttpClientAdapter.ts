import {CustomRequestFunction, CustomRequestOptions, CustomRequestResponse} from './interfaces-external';

/**
 * Adapter that wraps a custom request function to match the HttpClient interface
 * expected by the rest of the library.
 */
export default class HttpClientAdapter {
	private _customRequestFunction: CustomRequestFunction;
	private _userAgent?: string;

	constructor(customRequestFunction: CustomRequestFunction) {
		this._customRequestFunction = customRequestFunction;
	}

	/**
	 * User-agent string to include in requests
	 */
	get userAgent(): string | undefined {
		return this._userAgent;
	}

	set userAgent(value: string) {
		this._userAgent = value;
	}

	/**
	 * Static method to convert a plain object to multipart form data.
	 * This is called by HttpClient.simpleObjectToMultipartForm() in the existing code.
	 *
	 * For the adapter, we'll return the object directly and handle conversion in the request method.
	 */
	static simpleObjectToMultipartForm(obj: any): any {
		return obj;
	}

	/**
	 * Perform an HTTP request using the custom request function.
	 * This converts between the HttpClient interface and the CustomRequestFunction interface.
	 */
	async request(options: HttpClientRequestOptions): Promise<HttpClientResponse> {
		const headers = {...(options.headers || {})};

		// Add user-agent if set
		if (this._userAgent) {
			headers['user-agent'] = this._userAgent;
		}

		let body: string | Buffer | undefined;

		// Handle multipart form data - create it manually like HttpClient does
		if (options.multipartForm) {
			const boundary = '-----------------------------' + Date.now().toString() + Math.random().toString().slice(2);
			headers['content-type'] = `multipart/form-data; boundary=${boundary}`;

			const encodedBodyParts: Buffer[] = [];
			for (const key in options.multipartForm) {
				const formObject = options.multipartForm[key];
				const content = formObject.content;

				let head = `--${boundary}\r\nContent-Disposition: form-data; name="${key}"`;
				if (formObject.filename) {
					head += `; filename="${formObject.filename}"`;
				}
				if (formObject.contentType) {
					head += `\r\nContent-Type: ${formObject.contentType}`;
				}
				head += '\r\n\r\n';

				encodedBodyParts.push(Buffer.from(head, 'utf8'));
				encodedBodyParts.push(Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8'));
				encodedBodyParts.push(Buffer.from('\r\n', 'utf8'));
			}
			encodedBodyParts.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
			body = Buffer.concat(encodedBodyParts);
		}

		// Prepare custom request options
		const customOptions: CustomRequestOptions = {
			method: options.method,
			url: options.url,
			headers,
			queryParams: options.queryString,
			body: body // Pass Buffer directly
		};

		// Execute the custom request function
		const customResponse: CustomRequestResponse = await this._customRequestFunction(customOptions);

		// Parse response body
		let responseBody: string | Buffer = customResponse.body;
		if (typeof responseBody !== 'string' && !Buffer.isBuffer(responseBody)) {
			responseBody = String(responseBody);
		}

		let jsonBody: any;
		let textBody: string;
		let rawBody: Buffer;

		if (Buffer.isBuffer(responseBody)) {
			rawBody = responseBody;
			textBody = responseBody.toString('utf8');
		} else {
			textBody = responseBody;
			rawBody = Buffer.from(responseBody, 'utf8');
		}

		// Try to parse as JSON if content-type indicates JSON
		const responseContentType = this._getHeader(customResponse.headers, 'content-type');
		if (responseContentType && responseContentType.includes('application/json')) {
			try {
				jsonBody = JSON.parse(textBody);
			} catch (err) {
				// Not valid JSON, leave jsonBody undefined
			}
		}

		// Convert response to HttpClient format
		return {
			statusCode: customResponse.statusCode,
			headers: this._normalizeHeaders(customResponse.headers),
			url: customResponse.finalUrl,
			jsonBody,
			textBody,
			rawBody
		};
	}

	/**
	 * Get a header value case-insensitively
	 */
	private _getHeader(headers: Record<string, string | string[]>, name: string): string | undefined {
		const lowerName = name.toLowerCase();
		for (const [key, value] of Object.entries(headers)) {
			if (key.toLowerCase() === lowerName) {
				return Array.isArray(value) ? value[0] : value;
			}
		}
		return undefined;
	}

	/**
	 * Normalize headers to lowercase keys (HttpClient convention)
	 */
	private _normalizeHeaders(headers: Record<string, string | string[]>): Record<string, string | string[]> {
		const normalized: Record<string, string | string[]> = {};
		for (const [key, value] of Object.entries(headers)) {
			normalized[key.toLowerCase()] = value;
		}
		return normalized;
	}
}

/**
 * Local interfaces matching HttpClient's expected format
 */
interface HttpClientRequestOptions {
	method: 'GET' | 'POST';
	url: string;
	headers?: Record<string, string>;
	queryString?: Record<string, any>;
	multipartForm?: any;
}

interface HttpClientResponse {
	statusCode: number;
	headers: Record<string, string | string[]>;
	url: string;
	jsonBody?: any;
	textBody?: string;
	rawBody?: Buffer;
}
