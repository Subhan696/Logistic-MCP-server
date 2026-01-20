
import { prisma } from '../db/prismaClient';
import { queryInvoicesTool } from '../tools/queryInvoices';

async function main() {
    const targetEmail = 'subhankashif696@gmail.com';
    const broker = await prisma.broker.findFirst({
        where: { emailUser: targetEmail }
    });

    if (!broker) {
        console.error(`No broker found for email: ${targetEmail}`);
        return;
    }

    console.log(`Checking invoices for Broker: ${broker.emailUser}`);
    console.log('---------------------------------------------------------');

    const invoices = await queryInvoicesTool({
        broker_id: broker.id
    });

    console.log(`Found ${invoices.length} invoices in database.`);

    if (invoices.length > 0) {
        console.table(invoices.map(inv => ({
            id: inv.id.substring(0, 8) + '...',
            number: inv.invoiceNumber,
            carrier: inv.carrier,
            amount: `${inv.currency} ${inv.amount}`,
            due_date: inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : 'N/A',
            status: inv.status
        })));
    } else {
        console.log('No invoices found.');
    }
}

main().finally(() => prisma.$disconnect());
