/**
 * This example demonstrates how to use a custom HTTP library with steam-session
 * instead of the default @doctormckay/stdlib HttpClient.
 *
 * This allows you to use popular HTTP libraries like got, axios, node-fetch, or request.
 */

import {
	LoginSession,
	EAuthTokenPlatformType,
	CustomRequestFunction
} from '../src';

import got from 'got';
import { SocksProxyAgent } from 'socks-proxy-agent';


async function exampleWithProxy() {
	const sessionId = Math.random().toString(36).substring(2, 10); // Generate a random session ID for proxy authentication
	// Using proxy - comment out if you don't have valid proxy credentials
	const proxyAgent = new SocksProxyAgent(`socks5://xxxx-${sessionId}:xxx@proxy.xxxx.xxx:3120`);

	const customRequest: CustomRequestFunction = async (options) => {
		try {
			// Prepare got options
			const gotOptions: any = {
				method: options.method,
				searchParams: options.queryParams,
				agent: {  // Comment out if not using proxy
					https: proxyAgent
				},
				followRedirect: true,
				responseType: 'buffer', // Use buffer to handle both text and binary responses
				timeout: {
					request: 10000 // 10 second timeout
				},
				headers: options.headers
			};

			// Handle body if provided (already encoded, e.g. as multipart/form-data)
			if (options.body) {
				gotOptions.body = options.body;
			}

			console.log('Making request to:', options.url);
			console.log('Method:', options.method);
			console.log('Headers:', gotOptions.headers);
			console.log('Body type:', options.body ? (Buffer.isBuffer(options.body) ? 'Buffer' : 'string') : 'none');

			const response = await got(options.url, gotOptions);

			return {
				statusCode: response.statusCode,
				headers: response.headers,
				body: response.body, // This will be a Buffer
				finalUrl: response.url
			};
		} catch (error: any) {
			console.error('Request failed:', error.message);
			if (error.response) {
				console.error('Response status:', error.response.statusCode);
				console.error('Response body:', error.response.body?.toString());
				return {
					statusCode: error.response.statusCode,
					headers: error.response.headers,
					body: error.response.body,
					finalUrl: error.response.url
				};
			}
			throw error;
		}
	};

	let session = new LoginSession(EAuthTokenPlatformType.WebBrowser, {
		customRequestFunction: customRequest
	});

	session.on('authenticated', async () => {
		console.log('Successfully authenticated!');

		// Get web cookies
		let cookies = await session.getWebCookies();
		console.log('Got cookies:', cookies);
	});

	session.on('timeout', () => {
		console.log('Login timed out');
	});

	session.on('error', (err) => {
		console.error('Login error:', err);
	});

	// Start login
	let startResult = await session.startWithCredentials({
		accountName: 'xxx',
		password: 'xxxxx'
	});

	console.log('Login started:', startResult);

}

exampleWithProxy();