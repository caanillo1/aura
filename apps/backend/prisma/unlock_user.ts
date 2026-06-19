/**
 * Script puntual: desbloquea un usuario y resetea su contraseña.
 * Ejecutar: npx ts-node prisma/unlock_user.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const EMAIL    = 'implementacion4@sistemasinfotec.com.co';
const PASSWORD = 'Celeste1*';

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });

  if (!user) {
    console.error(`❌ Usuario no encontrado: ${EMAIL}`);
    process.exit(1);
  }

  console.log(`Usuario encontrado: ${user.firstName} ${user.lastName}`);
  console.log(`  isActive       : ${user.isActive}`);
  console.log(`  failedLogins   : ${user.failedLoginCount}`);
  console.log(`  lockedUntil    : ${user.lockedUntil ?? 'sin bloqueo'}`);

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  await prisma.user.update({
    where: { email: EMAIL },
    data: {
      isActive:         true,
      failedLoginCount: 0,
      lockedUntil:      null,
      passwordHash,
    },
  });

  console.log(`\n✅ Usuario desbloqueado y contraseña reestablecida.`);
  console.log(`   Email    : ${EMAIL}`);
  console.log(`   Password : ${PASSWORD}`);
}

main()
  .catch((e) => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
