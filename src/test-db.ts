import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Querying recent videos from database...');
  const videos = await prisma.video.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  for (const v of videos) {
    console.log(`- ID: ${v.id}`);
    console.log(`  Title: ${v.title}`);
    console.log(`  Status: ${v.status}`);
    console.log(`  VideoPath: ${v.videoPath}`);
    console.log(`  CreatedAt: ${v.createdAt}`);
    console.log('-----------------------------------');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
