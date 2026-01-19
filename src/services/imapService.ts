import { ImapFlow } from 'imapflow';
import { logger } from '../utils/logger';
import { simpleParser } from 'mailparser'; // NOTE: I might need to install mailparser if imapflow doesn't do it all
// simpleParser is from 'mailparser', which I haven't installed yet. imapflow assumes you use something to parse the stream usually.
// Or I can just store raw source if I want, but I usually want to parse parsing structure.
// Let's check dependencies I installed. imapflow.
// I should add mailparser.

export interface EmailSearchParams {
    since?: Date;
    subjectContains?: string;
    from?: string;
}

export class ImapService {
    private client: ImapFlow;

    constructor(config: any) {
        this.client = new ImapFlow({
            host: config.host,
            port: 993,
            secure: true,
            auth: {
                user: config.user,
                pass: config.pass
            },
            logger: false // internal logger
        });
    }

    async connect() {
        await this.client.connect();
    }

    async disconnect() {
        await this.client.logout();
    }

    async fetchEmails(params: EmailSearchParams) {
        const lock = await this.client.getMailboxLock('INBOX');
        try {
            const searchCriteria: any = {};
            if (params.since) {
                searchCriteria.since = params.since;
            }
            // imapflow search is distinct. 'seq' or query.
            // query object: { seen: false, from: '...', header: { 'subject': '...' } }

            // Constructing search query
            const query: any = {};
            if (params.from) query.from = params.from;
            if (params.subjectContains) query.header = { subject: params.subjectContains }; // basic approximation
            // 'since' is top level usually? imapflow specific syntax check needed.
            // ImapFlow 'search' method usage: client.search(query, options)

            // Let's keep it simple: Fetch all recent and filter, or use basic IMAP search
            // Filter logic might be safer in code if search support is complex

            // To get message IDs and basic info first
            // .fetch('1:*', { envelope: true })

            // Wait, let's look at `fetch` command.

            const messages: any[] = [];
            // Default to last 24 hours if 'since' is not provided to strictly prevent full mailbox scans
            const fetchSince = params.since || new Date(Date.now() - 24 * 60 * 60 * 1000);

            // Fetching emails (Envelope only - NO BODY/SOURCE)
            for await (const message of this.client.fetch({ since: fetchSince }, { envelope: true, source: false, internalDate: true })) {
                // Apply text filters here if needed
                if (!message.envelope) continue;
                if (params.subjectContains && !message.envelope.subject?.includes(params.subjectContains)) continue;
                if (params.from && (!message.envelope.from || !message.envelope.from.some((addr: any) => addr.address?.includes(params.from)))) continue;

                messages.push({
                    uid: message.uid,
                    seq: message.seq,
                    envelope: message.envelope,
                    // source: message.source, // Removed to improve performance
                    id: message.envelope.messageId,
                    date: message.internalDate
                });
            }
            return messages;
        } finally {
            lock.release();
        }
    }

    async fetchAttachments(messageId: string): Promise<{ filename: string, content: Buffer }[]> {
        const lock = await this.client.getMailboxLock('INBOX');
        try {
            // Fetch specific message by Message-ID
            // Note: Message-ID usually has angle brackets <...> in IMAP search if strict, usually stripped in DB? 
            // Let's assume input has them or we handle robustly.
            // Usually Message-ID in DB is clean. IMAP search for Header Message-ID should match.

            const messageGenerator = this.client.fetch({ header: { 'message-id': messageId } }, { source: true });

            for await (const message of messageGenerator) {
                if (message.source) {
                    const parsed = await simpleParser(message.source);
                    return parsed.attachments.map(att => ({
                        filename: att.filename || 'untitled.pdf',
                        content: att.content
                    }));
                }
            }
            return [];
        } catch (e) {
            logger.error('Failed to fetch attachments', e);
            return [];
        } finally {
            lock.release();
        }
    }
}
