import { z } from 'zod';
import { prisma } from '../db/prismaClient';
import { logger } from '../utils/logger';

// Input schema
export const storeInvoiceSchema = z.object({
    broker_id: z.string(),
    email_id: z.string(),
    pdf_path: z.string(),
    invoice_data: z.object({
        invoice_number: z.string(),
        carrier: z.string(),
        amount: z.number(),
        currency: z.string(),
        due_date: z.string().nullable().optional(),
        load_id: z.string().nullable().optional()
    })
});

export async function storeInvoiceTool(args: z.infer<typeof storeInvoiceSchema>) {
    const { broker_id, email_id, pdf_path, invoice_data } = args;

    // 1. Deduplicate
    const existing = await prisma.invoice.findUnique({
        where: {
            brokerId_invoiceNumber: {
                brokerId: broker_id,
                invoiceNumber: invoice_data.invoice_number
            }
        }
    });

    if (existing) {
        logger.info(`Invoice ${invoice_data.invoice_number} already exists for broker ${broker_id}`);
        return {
            message: 'Invoice already exists',
            invoice_id: existing.id
        };
    }

    // 2. Store
    const newInvoice = await prisma.invoice.create({
        data: {
            brokerId: broker_id,
            emailId: email_id,
            pdfPath: pdf_path,
            invoiceNumber: invoice_data.invoice_number,
            carrier: invoice_data.carrier,
            amount: invoice_data.amount,
            currency: invoice_data.currency,
            dueDate: invoice_data.due_date ? new Date(invoice_data.due_date) : null,
            status: 'UNPAID', // Default status
            extractedJson: JSON.stringify(invoice_data)
        }
    });

    logger.info(`Stored new invoice: ${newInvoice.id}`);

    return {
        message: 'Invoice stored successfully',
        invoice_id: newInvoice.id
    };
}
