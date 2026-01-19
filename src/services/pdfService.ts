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
        return await this.ocrExtract(filePath);
    }

    private async ocrExtract(filePath: string): Promise<string> {
        logger.info('Starting OCR...');
        // @ts-ignore
        const worker = await createWorker('eng');
        const { data: { text } } = await worker.recognize(filePath);
        await worker.terminate();
        logger.info(`OCR completed (${text.length} chars)`);
        return text;
    }
}

export const pdfService = new PdfService();
