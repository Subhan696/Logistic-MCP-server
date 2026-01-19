# Logistics Email Invoice MCP Server

A Model Context Protocol (MCP) server designed to help AI agents manage logistics invoices by fetching emails, downloading attachments, parsing PDFs, and storing structured data.

## Features

- **Fetch Emails**: Retrieve emails from broker mailboxes via IMAP.
- **Download Attachments**: specific PDF invoices from emails.
- **Parse Invoices**: Extract properties (Invoice #, Amount, Carrier, etc.) using `pdf-parse` and Generative AI (Gemini/OpenAI).
- **OCR Support**: Fallback to Tesseract.js if PDF is image-based.
- **Structured Storage**: Store metadata and file paths in PostgreSQL.
- **Secure**: Encrypted credentials and environment-based configuration.

## Prerequisites

- Node.js >= 18
- PostgreSQL Database
- Gemini API Key or OpenAI API Key

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   Copy `.env.example` to `.env` and fill in your details:
   ```bash
   cp .env.example .env
   ```
   - Set `DATABASE_URL` for your Postgres instance.
   - Set `GEMINI_API_KEY` or `OPENAI_API_KEY`.
   - Set `ENCRYPTION_KEY` (must be 32+ chars).

3. **Database Migration**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Seed Broker Data**
   Add a broker account to fetch emails from:
   ```bash
   npx ts-node src/db/seed.ts <email> <password> [imap_host]
   ```

## Usage

### Build & Run
```bash
npm run build
npm start
```

### MC Protocol Tools

The server exposes the following tools:

- `fetch_emails`: Check mailbox for new emails.
  - Args: `{ "broker_id": "...", "since": "2023-01-01" }`
- `download_attachments`: Download PDFs from a specific email.
  - Args: `{ "email_id": "..." }`
- `parse_invoice_pdf`: Extract text and data from a PDF file.
  - Args: `{ "pdf_path": "..." }`
- `store_invoice`: Save extracted data to DB.
  - Args: `{ "broker_id": "...", "email_id": "...", "pdf_path": "...", "invoice_data": {...} }`
- `query_invoices`: List invoices.
  - Args: `{ "broker_id": "..." }`

## Development

Run in dev mode with auto-reload:
```bash
npm run dev
```

## Architecture

- **Services**: `imapService`, `pdfService`, `aiExtractionService` handles logic.
- **Tools**: MCP interfaces located in `src/tools`.
- **DB**: Prisma ORM with PostgreSQL.

## License

ISC
