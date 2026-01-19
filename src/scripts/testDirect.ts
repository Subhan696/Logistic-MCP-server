import { prisma } from '../db/prismaClient';
import { fetchEmailsTool } from '../tools/fetchEmails';
import { downloadAttachmentsTool } from '../tools/downloadAttachments';

async function main() {
    // 1. Get the specific broker
    const targetEmail = 'subhankashif696@gmail.com';
    const broker = await prisma.broker.findFirst({
        where: { emailUser: targetEmail }
    });

    if (!broker) {
        console.error(`No broker found for email: ${targetEmail}. Run seedBroker.ts first.`);
        return;
    }

    console.log(`Testing with Broker: ${broker.emailUser} (ID: ${broker.id})`);
    console.log('---------------------------------------------------------');

    // 2. Test Fetch Emails
    console.log('Invoking fetchEmailsTool directly...');
    const startTime = Date.now();

    try {
        const result = await fetchEmailsTool({
            broker_id: broker.id,
            subject_contains: undefined, // Fetch all subjects
            since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
            has_attachments: true // Only emails with attachments
        });

        const duration = (Date.now() - startTime) / 1000;
        console.log(`✅ Fetch Success in ${duration}s`);
        console.log(`Found ${result.count} emails.`);

        if (result.emails.length > 0) {
            console.log('Sample Email:', result.emails[0]);

            // 3. Test Download Attachments (on the first result)
            const emailId = result.emails[0].id;
            console.log(`\nTesting downloadAttachmentsTool for Email ID: ${emailId}...`);
            const dlStart = Date.now();

            const dlResult = await downloadAttachmentsTool({
                email_id: emailId
            });

            const dlDuration = (Date.now() - dlStart) / 1000;
            console.log(`✅ Download Success in ${dlDuration}s`);
            console.log(dlResult);
        } else {
            console.log('No emails found to test attachment download.');
        }

    } catch (error) {
        console.error('❌ Error during test:');
        console.error(error);
    }
}

main().finally(() => prisma.$disconnect());
