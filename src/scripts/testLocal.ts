import { prisma } from '../db/prismaClient';
import { parseInvoicePdfTool } from '../tools/parseInvoicePdf';
import { storeInvoiceTool } from '../tools/storeInvoice';
import { queryInvoicesTool } from '../tools/queryInvoices';
import path from 'path';
import fs from 'fs';

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

    // 2. Define Local Files
    const samplesDir = path.join(__dirname, '../../storage/samples');
    const files = ['logistics.pdf', 'superstore.pdf'];

    console.log(`Testing with Broker: ${broker.emailUser}`);
    console.log(`Samples Directory: ${samplesDir}`);

    for (const file of files) {
        const pdfPath = path.join(samplesDir, file);
        if (!fs.existsSync(pdfPath)) {
            console.warn(`File not found: ${pdfPath}`);
            continue;
        }

        console.log('\n---------------------------------------------------------');
        console.log(`Processing File: ${file}`);

        try {
            // 3. Test Parse
            console.log('Parsing...');
            const invoiceData = await parseInvoicePdfTool({
                pdf_path: pdfPath
            });
            console.log('✅ Parse Result:', invoiceData);

            // 4. Test Store
            console.log('Storing...');
            const storeResult = await storeInvoiceTool({
                broker_id: broker.id,
                email_id: `LOCAL-TEST-${Date.now()}`, // Dummy Email ID
                pdf_path: pdfPath,
                invoice_data: {
                    invoice_number: invoiceData.invoice_number || `TEST-${Date.now()}`,
                    carrier: invoiceData.carrier || (file.includes('superstore') ? "Store" : "Unknown"),
                    amount: invoiceData.amount || 0,
                    currency: invoiceData.currency || "USD",
                    due_date: invoiceData.due_date,
                    load_id: invoiceData.load_id
                }
            });
            console.log('✅ Store Result:', storeResult);

        } catch (error) {
            console.error(`❌ Failed to process ${file}:`, error);
        }
    }

    // 5. Query Results
    console.log('\n---------------------------------------------------------');
    console.log('Querying Database...');
    const invoices = await queryInvoicesTool({ broker_id: broker.id });
    console.log(`Found ${invoices.length} invoices in DB.`);
    invoices.slice(0, 3).forEach(inv => console.log(`- ${inv.invoiceNumber}: ${inv.carrier} ($${inv.amount})`));
}

main().finally(() => prisma.$disconnect());
