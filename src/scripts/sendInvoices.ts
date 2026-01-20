import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv'; // Load env vars if not auto-loaded by runner, but usually safe to rely on test runner or pre-load
dotenv.config();

async function main() {
    console.log('--- Sending Sample Invoices ---');

    const emailUser = process.env.TEST_EMAIL_USER;
    const emailPass = process.env.TEST_EMAIL_PASSWORD;

    if (!emailUser || !emailPass || emailUser.includes('your-email')) {
        console.error('❌ ERROR: Missing credentials in .env file.');
        console.error('Please set TEST_EMAIL_USER and TEST_EMAIL_PASSWORD in d:\\projects\\MCP\\logistics\\.env');
        process.exit(1);
    }

    console.log(`Target Email: ${emailUser}`);

    // Create Transporter (Gmail)
    // Note: Depends on host. Assuming Gmail based on user context, but can try auto-detect or use host from seedBroker if available?
    // User said "gmail.com" so standard gmail service is easiest.
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: emailUser,
            pass: emailPass,
        },
    });

    const samplesDir = path.join(__dirname, '../../storage/samples');
    if (!fs.existsSync(samplesDir)) {
        console.error(`❌ Samples directory not found: ${samplesDir}`);
        return;
    }

    const files = fs.readdirSync(samplesDir).filter(f => f.toLowerCase().endsWith('.pdf'));

    if (files.length === 0) {
        console.error('❌ No PDF files found in storage/samples');
        return;
    }

    console.log(`Found ${files.length} PDFs to send: ${files.join(', ')}`);

    for (const file of files) {
        const filePath = path.join(samplesDir, file);
        console.log(`Sending ${file}...`);

        const mailOptions = {
            from: `"Logistics Test Bot" <${emailUser}>`,
            to: emailUser, // Send to self
            subject: `Logistics Invoice: ${file} - ${new Date().toISOString()}`,
            text: `Please find attached the invoice ${file}.\n\nSent by logistics-mcp test script.`,
            attachments: [
                {
                    filename: file,
                    path: filePath
                }
            ]
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log(`✅ Sent ${file}: ${info.messageId}`);
        } catch (error) {
            console.error(`❌ Failed to send ${file}:`, error);
        }
    }

    console.log('--- Done ---');
}

main().catch(console.error);
