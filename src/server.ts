import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import { logger } from "./utils/logger";

// Tools
import { fetchEmailsTool, fetchEmailsSchema } from "./tools/fetchEmails";
import { downloadAttachmentsTool, downloadAttachmentsSchema } from "./tools/downloadAttachments";
import { parseInvoicePdfTool, parseInvoicePdfSchema } from "./tools/parseInvoicePdf";
import { storeInvoiceTool, storeInvoiceSchema } from "./tools/storeInvoice";
import { queryInvoicesTool, queryInvoicesSchema } from "./tools/queryInvoices";
import { zodToJsonSchema } from "zod-to-json-schema";

dotenv.config();

const server = new Server(
    {
        name: "logistics-invoice-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Register Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "fetch_emails",
                description: "Fetch emails from broker mailbox via IMAP",
                inputSchema: zodToJsonSchema(fetchEmailsSchema as any) as any,
            },
            {
                name: "download_attachments",
                description: "Download PDF attachments from a specific email",
                inputSchema: zodToJsonSchema(downloadAttachmentsSchema as any) as any,
            },
            {
                name: "parse_invoice_pdf",
                description: "Extract structured invoice data from a PDF file using AI",
                inputSchema: zodToJsonSchema(parseInvoicePdfSchema as any) as any,
            },
            {
                name: "store_invoice",
                description: "Store extracted invoice data in the database",
                inputSchema: zodToJsonSchema(storeInvoiceSchema as any) as any,
            },
            {
                name: "query_invoices",
                description: "Query stored invoices by broker, status, or carrier",
                inputSchema: zodToJsonSchema(queryInvoicesSchema as any) as any,
            },
        ],
    };
});

// Handle Tool Calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const { name, arguments: args } = request.params;

        switch (name) {
            case "fetch_emails": {
                const parsed = fetchEmailsSchema.parse(args);
                const result = await fetchEmailsTool(parsed);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "download_attachments": {
                const parsed = downloadAttachmentsSchema.parse(args);
                const result = await downloadAttachmentsTool(parsed);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "parse_invoice_pdf": {
                const parsed = parseInvoicePdfSchema.parse(args);
                const result = await parseInvoicePdfTool(parsed);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "store_invoice": {
                const parsed = storeInvoiceSchema.parse(args);
                const result = await storeInvoiceTool(parsed);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "query_invoices": {
                const parsed = queryInvoicesSchema.parse(args);
                const result = await queryInvoicesTool(parsed);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
        logger.error("Tool execution error", error);
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
});

// Start Server
async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("Logistics MCP Server running on stdio");
}

run().catch((err) => {
    logger.fatal("Server failed to start", err);
    process.exit(1);
});
