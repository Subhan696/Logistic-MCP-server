import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

export interface InvoiceData {
    invoice_number: string;
    carrier: string;
    amount: number;
    currency: string;
    due_date: string | null;
    load_id?: string;
}

const SCHEMA_PROMPT = `
Extract the following fields from the invoice text and return ONLY valid JSON:
{
  "invoice_number": "string",
  "carrier": "string (Carrier Name OR Store/Merchant Name)",
  "amount": number,
  "currency": "string (USD, CAD, etc defaults to USD)",
  "due_date": "YYYY-MM-DD" or null,
  "load_id": "string" or null
}
If a field is not found, use null.
If you see a Store Name (e.g. Walmart, Target) instead of a Logistics Carrier, use that as the "carrier".
`;

export class AiExtractionService {
    private defaultProvider: string;

    constructor() {
        this.defaultProvider = process.env.AI_PROVIDER || 'gemini';
    }

    /**
     * Check which providers are available (have API keys/connectivity)
     */
    private checkAvailableProviders(): string[] {
        const available: string[] = [];
        
        if (process.env.OLLAMA_BASE_URL) {
            available.push('ollama'); // Ollama doesn't need API key
        }
        if (process.env.GEMINI_API_KEY) {
            available.push('gemini');
        }
        if (process.env.OPENAI_API_KEY) {
            available.push('openai');
        }
        
        return available;
    }

    /**
     * Get fallback providers in order of preference
     */
    private getFallbackChain(requestedProvider?: string): string[] {
        const requested = requestedProvider || this.defaultProvider;
        const available = this.checkAvailableProviders();
        
        if (available.length === 0) {
            throw new Error('No AI providers configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or OLLAMA_BASE_URL');
        }

        // If requested provider is available, use it
        if (available.includes(requested)) {
            return [requested, ...available.filter(p => p !== requested)];
        }

        // Otherwise, use available providers in order
        logger.warn(`Requested provider '${requested}' not available. Using fallback chain: ${available.join(' → ')}`);
        return available;
    }

    async extractInvoiceData(text: string, provider?: string): Promise<InvoiceData> {
        const fallbackChain = this.getFallbackChain(provider);
        const errors: { provider: string; error: string }[] = [];

        for (const activeProvider of fallbackChain) {
            try {
                logger.info(`Attempting extraction with ${activeProvider}...`);
                
                if (activeProvider === 'openai') {
                    return await this.extractOpenAI(text);
                } else if (activeProvider === 'ollama') {
                    return await this.extractOllama(text);
                } else {
                    return await this.extractGemini(text);
                }
            } catch (error: any) {
                const errorMsg = error.message || String(error);
                logger.warn(`${activeProvider} failed: ${errorMsg}`);
                errors.push({ provider: activeProvider, error: errorMsg });
                
                // Try next provider
                continue;
            }
        }

        // All providers failed
        const errorSummary = errors.map(e => `${e.provider}: ${e.error}`).join(' | ');
        throw new Error(`All AI providers failed. Tried: ${errorSummary}`);
    }

    private async extractGemini(text: string): Promise<InvoiceData> {
        const key = process.env.GEMINI_API_KEY;
        if (!key) throw new Error('GEMINI_API_KEY not set');

        // Models to rotate through (Based on user's available plan)
        const GEMINI_MODELS = [
            'gemini-2.5-flash-lite', // 10 RPM (Highest)
            'gemini-2.5-flash',      // 5 RPM
            'gemini-3-flash-preview' // 5 RPM
        ];

        let modelIndex = 0;
        const maxTotalRetries = 15; // Allow several full cycles
        let totalAttempts = 0;

        while (totalAttempts < maxTotalRetries) {
            const currentModelName = GEMINI_MODELS[modelIndex];

            try {
                // console.log(`  Trying model: ${currentModelName}...`); 
                const genAI = new GoogleGenerativeAI(key);
                const model = genAI.getGenerativeModel({ model: currentModelName });

                const result = await model.generateContent(`${SCHEMA_PROMPT}\n\nINVOICE TEXT:\n${text}`);
                const r = result.response.text();
                return this.parseJson(r);

            } catch (error: any) {
                // Retry on rate limits (429), overloaded (503), OR if model not found/supported (404)
                // If 404, we definitely want to try the next model in the list.
                const isRetryable = error.message?.includes('429') || error.status === 429 ||
                    error.message?.includes('503') || error.status === 503 ||
                    error.message?.includes('404') || error.status === 404;

                if (isRetryable) {
                    // Log the failure
                    console.log(`  ⚠️ Model ${currentModelName} failed (${error.status || error.message}).`);

                    // Move to next model
                    modelIndex = (modelIndex + 1) % GEMINI_MODELS.length;
                    totalAttempts++;

                    // If we cycled through all models and they all failed, wait a bit longer
                    if (totalAttempts % GEMINI_MODELS.length === 0) {
                        const waitTime = 10000; // 10s wait if all models are busy/broken
                        console.log(`  All models failed/busy. Waiting ${waitTime / 1000}s before restarting cycle...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    } else {
                        // Short pause between model switches
                        const shortWait = 1000;
                        console.log(`  Switching to ${GEMINI_MODELS[modelIndex]} in ${shortWait / 1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, shortWait));
                    }
                } else {
                    throw error; // Throw only if it's a completely unknown error (e.g. auth failure 401, or malformed request 400)
                }
            }
        }
        throw new Error('Gemini API Rate Limit Exceeded after exhausting all models and retries');
    }

    private async extractOpenAI(text: string): Promise<InvoiceData> {
        const key = process.env.OPENAI_API_KEY;
        if (!key) throw new Error('OPENAI_API_KEY not set');

        const openai = new OpenAI({ apiKey: key });
        const completion = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: SCHEMA_PROMPT },
                { role: 'user', content: text }
            ],
            model: 'gpt-3.5-turbo',
            response_format: { type: 'json_object' }
        });

        const r = completion.choices[0].message.content;
        if (!r) throw new Error('Empty response from OpenAI');
        return this.parseJson(r);
    }

    private async extractOllama(text: string): Promise<InvoiceData> {
        const model = process.env.OLLAMA_MODEL || 'llama3';
        const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

        try {
            const response = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: SCHEMA_PROMPT },
                        { role: 'user', content: text }
                    ],
                    stream: false,
                    format: 'json'
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any;
            const r = data.message?.content;

            if (!r) throw new Error('Empty response from Ollama');
            return this.parseJson(r);
        } catch (error: any) {
            logger.error('Ollama extraction failed', { error: error.message });
            throw error;
        }
    }

    private parseJson(input: string): InvoiceData {
        try {
            // Cleanup markdown code blocks if present
            const clean = input.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(clean);
        } catch (e) {
            logger.error('Failed to parse AI response', { input });
            throw new Error('AI response was not valid JSON');
        }
    }
}

export const aiExtractionService = new AiExtractionService();
