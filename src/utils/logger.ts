import pino from 'pino';
import fs from 'fs';
import path from 'path';

// Write logs to stderr (not stdout) to avoid interfering with MCP stdio transport
// MCP uses stdout for JSON-RPC messages only
const logFile = path.join(__dirname, '../../logs/server.log');
const logDir = path.dirname(logFile);

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
}, pino.destination({
    dest: logFile,
    sync: false
}));
