import fs from 'fs';
import pdf from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { logger } from '../utils/logger';

export class PdfService {
    async extractText(filePath: string): Promise<string> {
        const dataBuffer = fs.readFileSync(filePath);

        // 1. Try standard PDF extraction
        try {
            const data = await pdf(dataBuffer);
            const text = data.text.trim();

            if (text.length > 50) {
                logger.info(`PDF text extracted via standard parser (${text.length} chars)`);
                return text;
            }
            logger.warn('PDF text content sparse, attempting OCR...');
        } catch (err) {
            logger.error('PDF parse failed, falling back to OCR', err);
        }

        // 2. Fallback to OCR
        // OCR is currently causing hard crashes in worker threads. Disabling for stability.
        logger.warn('PDF text sparse but OCR disabled due to stability issues.');
        return "";
        // return await this.ocrExtract(filePath);
    }

    private async ocrExtract(filePath: string): Promise<string> {
        try {
            logger.info('Starting OCR...');
            // Tesseract v5 API: createWorker(langs, oem, options)
            // But types might be tricky. Let's force it or use the long form.
            // Disable TS check for this call as types are conflicting
            const worker = await createWorker('eng' as any);

            const ret = await worker.recognize(filePath);
            const text = ret.data.text;

            await worker.terminate();

            logger.info(`OCR completed (${text.length} chars)`);
            return text;
        } catch (error) {
            logger.error('OCR failed/crashed:', error);
            // Return empty string instead of crashing the whole process
            return "";
        }
    }
}

export const pdfService = new PdfService();
