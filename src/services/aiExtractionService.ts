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
    private provider: string;

    constructor() {
        this.provider = process.env.AI_PROVIDER || 'gemini';
    }

    async extractInvoiceData(text: string): Promise<InvoiceData> {
        if (this.provider === 'openai') {
            return this.extractOpenAI(text);
        }
        return this.extractGemini(text);
    }

    private async extractGemini(text: string): Promise<InvoiceData> {
        const key = process.env.GEMINI_API_KEY;
        if (!key) throw new Error('GEMINI_API_KEY not set');

        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                const result = await model.generateContent(`${SCHEMA_PROMPT}\n\nINVOICE TEXT:\n${text}`);
                const r = result.response.text();
                return this.parseJson(r);
            } catch (error: any) {
                if (error.message?.includes('429') || error.status === 429 ||
                    error.message?.includes('503') || error.status === 503) {
                    attempt++;
                    console.log(`⚠️ Gemini Service Error (${error.status || 'limit/overload'}). Waiting 60s before retry ${attempt}/${maxRetries}...`);
                    await new Promise(resolve => setTimeout(resolve, 60000));
                } else {
                    throw error;
                }
            }
        }
        throw new Error('Gemini API Rate Limit Exceeded after retries');
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
