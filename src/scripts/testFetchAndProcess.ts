import { prisma } from '../db/prismaClient';
import { fetchEmailsTool } from '../tools/fetchEmails';
import { downloadAttachmentsTool } from '../tools/downloadAttachments';
import { parseInvoicePdfTool } from '../tools/parseInvoicePdf';
import { storeInvoiceTool } from '../tools/storeInvoice';
import { queryInvoicesTool } from '../tools/queryInvoices';
import path from 'path';

async function main() {
    const targetEmail = 'subhankashif696@gmail.com';
    const broker = await prisma.broker.findFirst({
        where: { emailUser: targetEmail }
    });

    if (!broker) {
        console.error(`No broker found for email: ${targetEmail}`);
        return;
    }

    console.log(`Testing with Broker: ${broker.emailUser}`);
    console.log('Fetching emails from the last 48 hours (Limit 100 processed)...');

    // 1. Fetch Emails (Last 48 Hours)
    // 48 hours = 2 days
    const sinceDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const fetchResult = await fetchEmailsTool({
        broker_id: broker.id,
        since: sinceDate,
        has_attachments: true
    });

    console.log(`Found ${fetchResult.count} emails.`);

    // 2. Limit to 100 if more
    const emailsToProcess = fetchResult.emails.slice(0, 100);
    console.log(`Processing ${emailsToProcess.length} emails...`);

    for (const [index, email] of emailsToProcess.entries()) {
        console.log(`\n=== [${index + 1}/${emailsToProcess.length}] Processing Email: ${email.subject} (${email.id}) ===`);
        try {
            // 3. Download with Retries
            let dlResult;
            let retries = 3;
            while (retries > 0) {
                try {
                    dlResult = await downloadAttachmentsTool({ email_id: email.id });
                    break;
                } catch (err: any) {
                    retries--;
                    if (retries === 0) throw err;
                    console.warn(`  ⚠️ Download failed, retrying in 2s... (${err.message})`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            if (dlResult) {
                console.log(`  Downloaded ${dlResult.files.length} attachments.`);

                // 4. Parse & Store
                for (const pdfPath of dlResult.files) {
                    console.log(`    Parsing ${path.basename(pdfPath)}...`);

                    try {
                        const invoiceData = await parseInvoicePdfTool({
                            pdf_path: pdfPath
                        });
                        console.log('    ✅ Data:', JSON.stringify(invoiceData, null, 2));

                        await storeInvoiceTool({
                            broker_id: broker.id,
                            email_id: email.id,
                            pdf_path: pdfPath,
                            invoice_data: {
                                invoice_number: invoiceData.invoice_number || `MISSING-${Date.now()}`,
                                carrier: invoiceData.carrier || "Unknown",
                                amount: invoiceData.amount || 0,
                                currency: invoiceData.currency || "USD",
                                due_date: invoiceData.due_date,
                                load_id: invoiceData.load_id
                            }
                        });
                        console.log('    ✅ Stored in DB');

                    } catch (pError: any) {
                        console.error(`    ⚠️ Parse Error: ${pError.message}`);
                    }
                }
            }
        } catch (e: any) {
            console.error(`  ❌ Error processing email: ${e.message}`);
        }

        // Rate limiting delay
        console.log('  ⏳ Waiting 5s before next email...');
        await new Promise(r => setTimeout(r, 5000));
    }

    console.log('\n--- Test Complete ---');
}

main().finally(() => prisma.$disconnect());
