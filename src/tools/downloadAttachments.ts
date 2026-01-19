import { z } from 'zod';
import { prisma } from '../db/prismaClient';
import { decrypt } from '../utils/encryption';
import { ImapService } from '../services/imapService';
import { storageService } from '../services/storageService';
import { logger } from '../utils/logger';
import path from 'path';

export const downloadAttachmentsSchema = z.object({
    email_id: z.string()
});

export async function downloadAttachmentsTool(args: z.infer<typeof downloadAttachmentsSchema>) {
    const { email_id } = args;

    const email = await prisma.email.findUnique({
        where: { id: email_id },
        include: { broker: true }
    });

    if (!email) {
        throw new Error(`Email not found: ${email_id}`);
    }

    // Check if attachments already exist in DB?
    const existingAttachments = await prisma.attachment.findMany({ where: { emailId: email.id } });
    if (existingAttachments.length > 0) {
        logger.info(`Attachments already downloaded for email ${email_id}`);
        return {
            message: 'Attachments already downloaded',
            files: existingAttachments.map(a => a.filePath)
        };
    }

    const password = decrypt(email.broker.emailPasswordEncrypted);

    const imap = new ImapService({
        host: email.broker.emailHost,
        user: email.broker.emailUser,
        pass: password
    });

    try {
        await imap.connect();

        const attachments = await imap.fetchAttachments(email.messageId);

        const savedFiles: string[] = [];

        for (const att of attachments) {
            // Filter for PDF? Project goal says "Download PDF invoices and attachments".
            // Maybe filter only PDF? Or all? User says "Download PDF invoices and attachments" -> implies both.
            // But parse_invoice_pdf takes pdf_path.
            // Let's download all.

            const safeFilename = `${email.id.substring(0, 8)}_${att.filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
            const filePath = await storageService.saveFile('invoices', safeFilename, att.content); // Saving to invoices dir? Or attachments?
            // User says "Save to /storage/invoices". OK.

            await prisma.attachment.create({
                data: {
                    emailId: email.id,
                    filePath: filePath,
                    fileType: path.extname(att.filename) || 'unknown'
                }
            });

            savedFiles.push(filePath);
        }

        return {
            message: `Downloaded ${savedFiles.length} attachments`,
            files: savedFiles
        };
    } catch (err) {
        logger.error('Error downloading attachments', err);
        throw err;
    } finally {
        await imap.disconnect();
    }
}
