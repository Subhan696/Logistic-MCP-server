
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error('GEMINI_API_KEY not set');
        return;
    }

    try {
        console.log('Querying available models...');
        // Note: The Node SDK might not expose listModels directly on the main class in older versions, 
        // but typically it's available via the GoogleGenerativeAI instance or we can try a simple generation to check.
        // Actually, the SDK doesn't always expose listModels nicely. 
        // Let's try to infer availability by trying a simple prompt on a few common names.

        const modelsToCheck = [
            'gemini-1.5-flash',
            'gemini-1.5-flash-001',
            'gemini-1.5-flash-002',
            'gemini-1.5-pro',
            'gemini-1.0-pro',
            'gemini-pro',
            'gemini-3-flash-preview'
        ];

        const genAI = new GoogleGenerativeAI(key);

        for (const modelName of modelsToCheck) {
            process.stdout.write(`Checking ${modelName}... `);
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent('Hello');
                console.log(`✅ Available (Response: ${result.response.text().substring(0, 20)}...)`);
            } catch (error: any) {
                if (error.message?.includes('404') || error.status === 404) {
                    console.log(`❌ 404 Not Found`);
                } else if (error.message?.includes('429') || error.status === 429) {
                    console.log(`⚠️ 429 Rate Limit (Exists but busy)`);
                } else {
                    console.log(`❓ Error: ${error.status || error.message}`);
                }
            }
        }

    } catch (error) {
        console.error('Fatal error:', error);
    }
}

main();
