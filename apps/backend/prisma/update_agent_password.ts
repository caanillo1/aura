/**
 * Script puntual: actualiza agentRegPassword en la empresa Sistemas Infotec.
 * Ejecutar: npx ts-node prisma/update_agent_password.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const newPassword = 'Celeste1*';
  const hash = await bcrypt.hash(newPassword, 12);

  const updated = await prisma.company.update({
    where: { nit: '900000000-0' },
    data:  { agentRegPassword: hash },
    select: { id: true, name: true },
  });

  console.log(`✅ Contraseña de registro de agente actualizada.`);
  console.log(`   Empresa : ${updated.name}`);
  console.log(`   Nueva   : ${newPassword}`);
}

main()
  .catch((e) => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
