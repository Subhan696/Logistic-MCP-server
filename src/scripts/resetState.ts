import { prisma } from '../db/prismaClient';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

async function main() {
    console.log('🗑️  Starting System Cleanup...');

    // 1. Clean Database
    console.log('   Cleaning Database...');
    const deletedInvoices = await prisma.invoice.deleteMany({});
    console.log(`   - Deleted ${deletedInvoices.count} invoices.`);

    const deletedAttachments = await prisma.attachment.deleteMany({});
    console.log(`   - Deleted ${deletedAttachments.count} attachments.`);

    // Note: We do NOT delete Emails or Brokers as they are needed for the test to run.

    // 2. Clean Storage
    console.log('   Cleaning Storage...');
    const storageDir = path.join(__dirname, '../../storage/invoices');
    if (fs.existsSync(storageDir)) {
        const files = fs.readdirSync(storageDir);
        let deletedCount = 0;
        for (const file of files) {
            if (file !== '.gitkeep') {
                fs.unlinkSync(path.join(storageDir, file));
                deletedCount++;
            }
        }
        console.log(`   - Deleted ${deletedCount} files from storage/invoices.`);
    } else {
        console.log('   - Storage directory does not exist.');
    }

    // 3. Clean Logs (if any log files)
    // Assuming pino might be logging to a file or just stdout.
    // If there is a logs directory?
    const logsDir = path.join(__dirname, '../../logs');
    if (fs.existsSync(logsDir)) {
        const files = fs.readdirSync(logsDir);
        for (const file of files) {
            fs.unlinkSync(path.join(logsDir, file));
        }
        console.log('   - Cleared logs directory.');
    }

    console.log('✅ Cleanup Complete. System is ready for fresh testing.');
}

main()
    .catch(e => {
        console.error('❌ Cleanup Failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
