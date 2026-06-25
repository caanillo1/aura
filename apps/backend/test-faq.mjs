import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const COMPANY_ID = '84f3f882-de79-4bb2-805e-eb35cd005fa7';

async function run() {
  // Test INSERT con companyId real
  try {
    const nombre = 'TestDebug';
    const now    = new Date();
    const r = await p.$executeRaw`
      INSERT INTO FaqTipos (id, companyId, nombre, orden, activo, createdAt, updatedAt)
      VALUES (NEWID(), CONVERT(uniqueidentifier,${COMPANY_ID}), ${nombre}, 0, 1, ${now}, ${now})
    `;
    console.log('INSERT OK rows:', r);

    const rows = await p.$queryRaw`SELECT id, nombre, companyId FROM FaqTipos WHERE nombre = ${nombre}`;
    console.log('SELECT back:', JSON.stringify(rows));

    if (rows.length) {
      const id = rows[0].id;
      await p.$executeRaw`DELETE FROM FaqTipos WHERE id = CONVERT(uniqueidentifier,${id})`;
      console.log('DELETE OK');
    }
  } catch(e) { console.error('Error:', e.message); }

  await p.$disconnect();
}
run();
