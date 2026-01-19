import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export class StorageService {
    private baseDir: string;

    constructor(baseDir: string = path.join(process.cwd(), 'storage')) {
        this.baseDir = baseDir;
        this.ensureDirs();
    }

    private ensureDirs() {
        const dirs = ['emails', 'invoices'];
        dirs.forEach(d => {
            const p = path.join(this.baseDir, d);
            if (!fs.existsSync(p)) {
                fs.mkdirSync(p, { recursive: true });
            }
        });
    }

    async saveFile(subDir: 'emails' | 'invoices', fileName: string, data: Buffer): Promise<string> {
        const filePath = path.join(this.baseDir, subDir, fileName);
        await fs.promises.writeFile(filePath, data);
        logger.info(`File saved: ${filePath}`);
        return filePath;
    }

    async readFile(filePath: string): Promise<Buffer> {
        return await fs.promises.readFile(filePath);
    }

    getFilePath(subDir: 'emails' | 'invoices', fileName: string): string {
        return path.join(this.baseDir, subDir, fileName);
    }
}

export const storageService = new StorageService();
