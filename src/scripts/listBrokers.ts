import { prisma } from '../db/prismaClient';

async function main() {
    const brokers = await prisma.broker.findMany();
    console.log('BROKERS:');
    brokers.forEach(b => console.log(b.id));
}

main().finally(() => prisma.$disconnect());
