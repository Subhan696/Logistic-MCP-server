import { prisma } from './prismaClient';
import { encrypt } from '../utils/encryption';
import { logger } from '../utils/logger';

async function main() {
    const brokerEmail = process.argv[2];
    const brokerPass = process.argv[3];
    const brokerHost = process.argv[4] || 'imap.gmail.com';

    if (!brokerEmail || !brokerPass) {
        console.log('Usage: npx ts-node src/db/seed.ts <email> <password> [host]');
        process.exit(1);
    }

    const encrypted = encrypt(brokerPass);

    const broker = await prisma.broker.create({
        data: {
            name: 'Test Broker',
            emailHost: brokerHost,
            emailUser: brokerEmail,
            emailPasswordEncrypted: encrypted
        }
    });

    logger.info(`Created broker with ID: ${broker.id}`);
}

main()
    .catch(e => {
        logger.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
