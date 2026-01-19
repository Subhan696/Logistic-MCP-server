import { z } from 'zod';
import { prisma } from '../db/prismaClient';

export const queryInvoicesSchema = z.object({
    broker_id: z.string(),
    status: z.enum(['PAID', 'UNPAID']).optional(),
    carrier: z.string().optional()
});

export async function queryInvoicesTool(args: z.infer<typeof queryInvoicesSchema>) {
    const { broker_id, status, carrier } = args;

    const where: any = { brokerId: broker_id };
    if (status) where.status = status;
    if (carrier) where.carrier = { contains: carrier, mode: 'insensitive' };

    const invoices = await prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            invoiceNumber: true,
            carrier: true,
            amount: true,
            currency: true,
            dueDate: true,
            status: true
        }
    });

    return invoices;
}
