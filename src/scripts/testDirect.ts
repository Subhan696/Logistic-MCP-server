import { prisma } from '../db/prismaClient';
import { fetchEmailsTool } from '../tools/fetchEmails';
import { downloadAttachmentsTool } from '../tools/downloadAttachments';
import { parseInvoicePdfTool } from '../tools/parseInvoicePdf';
import { storeInvoiceTool } from '../tools/storeInvoice';
import { queryInvoicesTool } from '../tools/queryInvoices';

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

            // 4. Test Parse Invoice PDF (if we got a file)
            if (dlResult.files && dlResult.files.length > 0) {
                const pdfPath = dlResult.files[0];
                console.log(`\nTesting parseInvoicePdfTool for: ${pdfPath}...`);

                // We need to implement this part, but it might fail if LLM is not configured or file isn't an invoice
                // For safety, we wrap in try/catch to continue testing
                let invoiceData;
                try {
                    invoiceData = await parseInvoicePdfTool({
                        pdf_path: pdfPath
                    });
                    console.log('✅ Parse Success:');
                    console.log(invoiceData);
                } catch (parseErr) {
                    console.error('⚠️ Parse failed (expected if AI not set up or PDF not invoice):', parseErr);
                }

                // 5. Test Store Invoice (only if parse succeeded)
                if (invoiceData) {
                    console.log(`\nTesting storeInvoiceTool...`);
                    const storeResult = await storeInvoiceTool({
                        broker_id: broker.id,
                        email_id: emailId,
                        pdf_path: pdfPath,
                        invoice_data: {
                            invoice_number: invoiceData.invoice_number || `TEST-${Date.now()}`, // Fallback for testing
                            carrier: invoiceData.carrier || "Test Carrier",
                            amount: invoiceData.amount || 100.00,
                            currency: invoiceData.currency || "USD",
                            due_date: invoiceData.due_date,
                            load_id: invoiceData.load_id
                        }
                    });
                    console.log('✅ Store Success:', storeResult);
                }

                // 6. Test Query Invoices
                console.log(`\nTesting queryInvoicesTool...`);
                const invoices = await queryInvoicesTool({
                    broker_id: broker.id
                });
                console.log(`✅ Query Success. Found ${invoices.length} invoices.`);
                if (invoices.length > 0) console.log(invoices[0]);
            }

        } else {
            console.log('No emails found to test attachment download chain.');
        }

    } catch (error) {
        console.error('❌ Error during test:');
        console.error(error);
    }
}

main().finally(() => prisma.$disconnect());
