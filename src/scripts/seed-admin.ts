import 'dotenv/config';
import { prisma } from '../lib/db';
import { hashPassword } from '../lib/auth';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans .env');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Un utilisateur existe déjà pour ${email}, aucune action effectuée.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({ data: { email, passwordHash } });
  console.log(`Compte admin créé avec succès pour ${email}.`);
}

main()
  .catch((err) => {
    console.error('Erreur lors du seed admin:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
