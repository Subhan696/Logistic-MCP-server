import { ImapFlow } from 'imapflow';
import { logger } from '../utils/logger';
import { simpleParser } from 'mailparser';

export interface EmailSearchParams {
    since?: Date;
    subjectContains?: string;
    from?: string;
    hasAttachments?: boolean;
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
            logger: logger // Using pino logger for debug visibility
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
            const messages: any[] = [];

            // Default to last 24 hours if 'since' is not provided to strictly prevent full mailbox scans
            const fetchSince = params.since || new Date(Date.now() - 24 * 60 * 60 * 1000);

            const fetchOptions: any = {
                envelope: true,
                source: false, // Do NOT download full source for listing
                internalDate: true,
                uid: true
            };

            // If we need to filter by attachments, we need the body structure
            if (params.hasAttachments) {
                fetchOptions.bodyStructure = true;
            }

            console.log(`[ImapService] Fetching emails since ${fetchSince.toISOString()}...`);

            for await (const message of this.client.fetch({ since: fetchSince }, fetchOptions)) {
                if (!message.envelope) continue;

                // Filters
                if (params.subjectContains && !message.envelope.subject?.includes(params.subjectContains)) continue;
                if (params.from && (!message.envelope.from || !message.envelope.from.some((addr: any) => addr.address?.includes(params.from)))) continue;

                // Attachment Filter
                if (params.hasAttachments) {
                    const hasAtt = this.checkForAttachments(message.bodyStructure);
                    if (!hasAtt) continue;
                }

                messages.push({
                    uid: message.uid,
                    seq: message.seq,
                    envelope: message.envelope,
                    id: message.envelope.messageId,
                    date: message.internalDate
                });
            }
            return messages;
        } finally {
            lock.release();
        }
    }

    private checkForAttachments(structure: any): boolean {
        if (!structure) return false;

        // Recursive check
        const check = (part: any): boolean => {
            if (part.disposition === 'attachment' || part.dispositionParameters?.filename || (part.parameters && part.parameters.name)) {
                return true;
            }
            if (part.childNodes) {
                return part.childNodes.some(check);
            }
            return false;
        };

        return check(structure);
    }

    async fetchAttachments(messageId: string): Promise<{ filename: string, content: Buffer }[]> {
        console.log(`[ImapService] Fetching attachments for ${messageId}...`);

        // We use mailboxOpen instead of lock for potentially better concurrency/less deadlocking
        await this.client.mailboxOpen('INBOX');

        try {
            // Fetch specific message by Message-ID. 
            // We fetch the FULL source here and use simpleParser because it is more robust than manual bodyStructure parsing
            // when dealing with complex MIME types, despite being heavier on bandwidth.
            const messageGenerator = this.client.fetch({ header: { 'message-id': messageId } }, { source: true, uid: true });

            for await (const message of messageGenerator) {
                if (message.source) {
                    console.log(`[ImapService] Source fetched (${message.source.length} bytes). Parsing...`);
                    const parsed = await simpleParser(message.source);

                    if (parsed.attachments && parsed.attachments.length > 0) {
                        console.log(`[ImapService] Parsed. Found ${parsed.attachments.length} attachments.`);
                        return parsed.attachments.map(att => ({
                            filename: att.filename || 'untitled.pdf',
                            content: att.content
                        }));
                    } else {
                        console.log('[ImapService] Parsed but NO attachments found.');
                    }
                }
            }
            return [];
        } catch (e) {
            logger.error('Failed to fetch attachments', e);
            throw e;
        }
    }
}
