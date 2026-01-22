# Testing MCP Server with Claude Desktop

## Step 1: Configure Claude Desktop

1. **Find Claude Desktop config file:**
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Full path: `C:\Users\YourUsername\AppData\Roaming\Claude\claude_desktop_config.json`

2. **Edit the config file** and add your MCP server:

```json
{
  "mcpServers": {
    "logistics-invoice": {
      "command": "node",
      "args": [
        "d:\\projects\\MCP\\logistics\\dist\\server.js"
      ],
      "env": {
        "DATABASE_URL": "postgresql://postgres:password@localhost:5432/logistics?schema=public",
        "AI_PROVIDER": "ollama",
        "OLLAMA_MODEL": "llama3.2",
        "OLLAMA_BASE_URL": "http://localhost:11434",
        "ENCRYPTION_KEY": "your-secret-key-min-32-chars",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

3. **Restart Claude Desktop** completely (quit and reopen)

4. **Verify it's working:**
   - Look for the 🔌 (plug) icon in Claude Desktop
   - Click it to see available MCP servers
   - You should see "logistics-invoice" with 5 tools:
     - fetch_emails
     - download_attachments
     - parse_invoice_pdf
     - store_invoice
     - query_invoices

5. **Test with Claude:**
   Ask Claude something like:
   ```
   Can you parse the invoice at d:\projects\MCP\logistics\storage\samples\invoice_118.pdf?
   ```

## Step 2: Alternative - Use MCP Inspector (Dev Tool)

The MCP Inspector is a web-based testing tool:

### Install MCP Inspector
```bash
npm install -g @modelcontextprotocol/inspector
```

### Run Inspector
```bash
cd d:\projects\MCP\logistics
npx @modelcontextprotocol/inspector node dist/server.js
```

This will:
- Start your MCP server
- Open a web UI at http://localhost:5173
- Let you test each tool manually with JSON inputs

### Test example in Inspector:
1. Select `parse_invoice_pdf` tool
2. Input JSON:
```json
{
  "pdf_path": "d:\\projects\\MCP\\logistics\\storage\\samples\\invoice_118.pdf"
}
```
3. Click "Run Tool"
4. See the extracted invoice data

## Step 3: Direct Command Line Testing

### Test server starts correctly:
```bash
cd d:\projects\MCP\logistics
node dist/server.js
```

If it starts without errors, press Ctrl+C to stop.

### Test with stdio manually (Advanced):
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/server.js
```

## Step 4: Integration with Other AI Tools

### Cline (VS Code Extension)
Add to Cline settings:
```json
{
  "mcpServers": {
    "logistics": {
      "command": "node",
      "args": ["d:\\projects\\MCP\\logistics\\dist\\server.js"]
    }
  }
}
```

### Continue.dev
Similar config in Continue extension settings.

## Troubleshooting

### Claude Desktop not showing tools:
- Check config file syntax (valid JSON)
- Ensure paths use double backslashes (`\\`) in JSON
- Check Claude Desktop logs: `%APPDATA%\Claude\logs\`
- Restart Claude Desktop completely

### Server won't start:
- Make sure PostgreSQL is running
- Make sure Ollama is running (`ollama serve`)
- Check environment variables in config
- Build the project: `npm run build`

### Ollama not responding:
- Start Ollama: `ollama serve`
- Pull the model: `ollama pull llama3.2`
- Test: `curl http://localhost:11434/api/tags`

## Quick Test Workflow

1. **Build**: `npm run build`
2. **Check Ollama**: `ollama list` (should show llama3.2)
3. **Check DB**: `npx prisma db push`
4. **Configure Claude Desktop** (see above)
5. **Restart Claude Desktop**
6. **Test in Chat**: "Parse invoice_118.pdf from my samples folder"
