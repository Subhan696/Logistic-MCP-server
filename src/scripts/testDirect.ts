import { prisma } from '../db/prismaClient';
import { fetchEmailsTool } from '../tools/fetchEmails';
import { downloadAttachmentsTool } from '../tools/downloadAttachments';
import { parseInvoicePdfTool } from '../tools/parseInvoicePdf';
import { storeInvoiceTool } from '../tools/storeInvoice';
import { queryInvoicesTool } from '../tools/queryInvoices';
import path from 'path';

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
            subject_contains: undefined,
            since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
            has_attachments: true
        });

        const duration = (Date.now() - startTime) / 1000;
        console.log(`✅ Fetch Success in ${duration}s`);
        console.log(`Found ${result.count} emails.`);

        // Process up to 5 emails to avoid excessive API usage during testing
        const emailsToProcess = result.emails.slice(0, 5);
        if (result.emails.length > 5) {
            console.log(`⚠️ Limit: Processing only first 5 of ${result.emails.length} emails.`);
        }

        if (emailsToProcess.length > 0) {
            for (const email of emailsToProcess) {
                console.log(`\n=== Processing Email: ${email.subject} (${email.id}) ===`);

                try {
                    // 3. Test Download Attachments
                    console.log(`Downloading attachments...`);
                    const dlStart = Date.now();
                    const dlResult = await downloadAttachmentsTool({
                        email_id: email.id
                    });
                    const dlDuration = (Date.now() - dlStart) / 1000;
                    console.log(`✅ Downloaded ${dlResult.files.length} files in ${dlDuration}s`);

                    // 4. Test Parse & Store for each file
                    if (dlResult.files && dlResult.files.length > 0) {
                        for (const pdfPath of dlResult.files) {
                            console.log(`\n  Processing File: ${path.basename(pdfPath)}...`);

                            let invoiceData;
                            try {
                                invoiceData = await parseInvoicePdfTool({
                                    pdf_path: pdfPath
                                });
                                console.log('  ✅ Parsed Data:', JSON.stringify(invoiceData, null, 2));
                            } catch (parseErr) {
                                console.error('  ⚠️ Parse failed:', parseErr);
                                continue;
                            }

                            if (invoiceData) {
                                console.log(`  Storing invoice...`);
                                const storeResult = await storeInvoiceTool({
                                    broker_id: broker.id,
                                    email_id: email.id,
                                    pdf_path: pdfPath,
                                    invoice_data: {
                                        invoice_number: invoiceData.invoice_number || `TEST-${Date.now()}`,
                                        carrier: invoiceData.carrier || "Test Carrier",
                                        amount: invoiceData.amount || 0,
                                        currency: invoiceData.currency || "USD",
                                        due_date: invoiceData.due_date,
                                        load_id: invoiceData.load_id
                                    }
                                });
                                console.log('  ✅ Stored:', storeResult);
                            }
                        }
                    } else {
                        console.log('  No files downloaded for this email.');
                    }
                } catch (emailError) {
                    console.error(`❌ Failed to process email ${email.id}:`, emailError);
                }
            }
        } else {
            console.log('No emails found in the last 24 hours with attachments.');
        }

        // 5. Final Verification: Query Invoices
        console.log('\n---------------------------------------------------------');
        console.log('Verifying stored invoices...');
        const storedInvoices = await queryInvoicesTool({ broker_id: broker.id });
        console.log(`✅ Database currently has ${storedInvoices.length} invoices for this broker.`);


    } catch (error) {
        console.error('❌ Error during test:');
        console.error(error);
    }
}

main().finally(() => prisma.$disconnect());
