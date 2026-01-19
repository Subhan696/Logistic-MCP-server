import { prisma } from '../db/prismaClient';
import { encrypt } from '../utils/encryption';

async function main() {
    console.log('Creating a Real Broker Configuration...');

    // --- INSTRUCTIONS ---
    // 1. Replace the values below with your real IMAP details.
    // 2. For Gmail, you MUST use an "App Password" (https://myaccount.google.com/apppasswords), not your login password.
    // 3. For Outlook/Office365, similar app password or specific SMTP/IMAP settings are needed.

    const REAL_CONFIG = {
        name: 'My Real Email',
        emailHost: 'imap.gmail.com',  // Customise this: imap.gmail.com, outlook.office365.com, etc.
        emailUser: 'subhankashif696@gmail.com', // <--- PUT YOUR EMAIL HERE
        emailPassword: 'tlpb vngj xjpq nrex' // <--- PUT YOUR APP PASSWORD HERE
    };

    if (REAL_CONFIG.emailUser.includes('YOUR_EMAIL')) {
        console.error('❌ PLEASE EDIT root/src/scripts/seedBroker.ts AND ADD YOUR REAL CREDENTIALS FIRST!');
        process.exit(1);
    }

    // Create the broker
    const broker = await prisma.broker.create({
        data: {
            name: REAL_CONFIG.name,
            emailHost: REAL_CONFIG.emailHost,
            emailUser: REAL_CONFIG.emailUser,
            emailPasswordEncrypted: encrypt(REAL_CONFIG.emailPassword),
        }
    });

    console.log('\n✅ Broker Created Successfully!');
    console.log('---------------------------------------------------');
    console.log(`NEW BROKER ID: ${broker.id}`);
    console.log('---------------------------------------------------');
    console.log(`You can now ask Claude:`);
    console.log(`"Fetch emails for broker ${broker.id}..."`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
