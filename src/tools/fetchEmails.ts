import { z } from 'zod';
import { prisma } from '../db/prismaClient';
import { decrypt } from '../utils/encryption';
import { ImapService } from '../services/imapService';
import { logger } from '../utils/logger';

export const fetchEmailsSchema = z.object({
    broker_id: z.string(),
    since: z.string().optional(), // ISO date string
    subject_contains: z.string().optional(),
    from: z.string().optional()
});

export async function fetchEmailsTool(args: z.infer<typeof fetchEmailsSchema>) {
    const { broker_id, since, subject_contains, from } = args;

    // 1. Get Broker Credentials
    const broker = await prisma.broker.findUnique({ where: { id: broker_id } });
    if (!broker) {
        throw new Error(`Broker not found: ${broker_id}`);
    }

    const password = decrypt(broker.emailPasswordEncrypted);

    // 2. Connect to IMAP
    const imap = new ImapService({
        host: broker.emailHost,
        user: broker.emailUser,
        pass: password
    });

    try {
        await imap.connect();

        // 3. Fetch
        const emails = await imap.fetchEmails({
            since: since ? new Date(since) : undefined,
            subjectContains: subject_contains,
            from: from
        });

        const results = [];

        // 4. Store in DB
        for (const email of emails) {
            // Check deduplication
            const existing = await prisma.email.findUnique({ where: { messageId: email.id } });
            if (existing) {
                results.push(existing);
                continue;
            }

            const created = await prisma.email.create({
                data: {
                    brokerId: broker.id,
                    messageId: email.id,
                    from: email.envelope.from[0]?.address || 'unknown',
                    subject: email.envelope.subject || '(no subject)',
                    date: email.date,
                    // We assume we might want to store raw source or body, but for now schema has rawBody
                    // 'email.source' is a Buffer. Convert to string or just store summary?
                    // Schema says 'rawBody'. Let's store a snippet or full text if possible.
                    // For now, let's leave rawBody empty until we download full content or parse it.
                    // Or if imapService returns source, we can store it.
                    // imapService returns source: true, so email.source is Buffer.
                    // rawBody: email.source.toString().substring(0, 1000) + '...' // Truncate for now to save DB space
                    // We no longer fetch source for listing to ensure speed.
                    rawBody: null
                }
            });
            results.push(created);
        }

        return {
            count: results.length,
            emails: results.map(e => ({ id: e.id, subject: e.subject, from: e.from, date: e.date }))
        };

    } catch (err) {
        logger.error('Error fetching emails', err);
        throw err;
    } finally {
        await imap.disconnect();
    }
}
