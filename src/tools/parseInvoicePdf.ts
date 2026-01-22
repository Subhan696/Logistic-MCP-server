import { z } from 'zod';
import { pdfService } from '../services/pdfService';
import { aiExtractionService } from '../services/aiExtractionService';
import { logger } from '../utils/logger';
import fs from 'fs';

export const parseInvoicePdfSchema = z.object({
    pdf_path: z.string(),
    ai_provider: z.enum(['ollama', 'gemini', 'openai']).optional().describe(
        'AI provider to use: ollama (local/free), gemini (balanced), openai (most accurate). ' +
        'If specified provider unavailable or out of credits, automatically falls back to others. ' +
        'Defaults to AI_PROVIDER env var.'
    )
});

export async function parseInvoicePdfTool(args: z.infer<typeof parseInvoicePdfSchema>) {
    const { pdf_path, ai_provider } = args;

    if (!fs.existsSync(pdf_path)) {
        throw new Error(`File not found: ${pdf_path}`);
    }

    try {
        const text = await pdfService.extractText(pdf_path);
        if (!text || text.trim().length === 0) {
            throw new Error('Failed to extract text from PDF');
        }

        const data = await aiExtractionService.extractInvoiceData(text, ai_provider);
        return data;
    } catch (err) {
        logger.error('Error parsing invoice PDF', err);
        throw err;
    }
}
