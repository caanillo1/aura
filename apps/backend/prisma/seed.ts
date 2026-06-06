import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de AURA ERP...');

  // ── Contraseñas hasheadas ──────────────────────────────────────────────────
  const rootHash  = await bcrypt.hash('Admin@2024!', 12);   // Admin del sistema
  const agentHash = await bcrypt.hash('Celeste1*', 12);     // Para registro de agentes

  // ── Empresa: Sistemas Infotec ──────────────────────────────────────────────
  const company = await prisma.company.upsert({
    where:  { nit: '900000000-0' },
    update: {},
    create: {
      name:             'Sistemas Infotec',
      commercialName:   'Infotec',
      nit:              '900000000-0',
      email:            'admin@infotec.com',
      primaryColor:     '#1E3A5F',
      secondaryColor:   '#2D5086',
      rootPassword:     rootHash,
      agentRegPassword: agentHash,
      filesBasePath:    'C:\\AURA_FILES\\FILES',
      city:             'Bogotá',
      department:       'Cundinamarca',
      phone:            '6017001000',
    },
  });
  console.log(`Empresa creada: ${company.name} (${company.nit})`);

  // ── Roles del sistema ──────────────────────────────────────────────────────
  const roles = [
    { name: 'Administrador',             slug: 'admin',                description: 'Acceso total al sistema' },
    { name: 'Coordinador',               slug: 'coordinator',          description: 'Supervisa implementaciones' },
    { name: 'Implementador Asistencial', slug: 'implementer_clinical', description: 'Implementa módulos clínicos' },
    { name: 'Implementador Financiero',  slug: 'implementer_financial',description: 'Implementa módulos financieros' },
    { name: 'Implementador de Apoyo',    slug: 'implementer_support',  description: 'Apoyo en actividades específicas' },
    { name: 'Soporte',                   slug: 'support',              description: 'Recibe clientes productivos' },
    { name: 'Cliente',                   slug: 'client',               description: 'Portal de consulta para el cliente' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where:  { companyId_slug: { companyId: company.id, slug: role.slug } },
      update: {},
      create: { ...role, companyId: company.id, isSystem: true },
    });
    console.log(`  Rol: ${role.name}`);
  }

  // ── Usuario administrador inicial ─────────────────────────────────────────
  const adminRole = await prisma.role.findFirst({
    where: { companyId: company.id, slug: 'admin' },
  });

  if (adminRole) {
    const adminHash = await bcrypt.hash('Admin@2024!', 12);
    await prisma.user.upsert({
      where:  { email: 'admin@infotec.com' },
      update: {},
      create: {
        companyId:    company.id,
        roleId:       adminRole.id,
        userType:     'agent',
        document:     '1000000001',
        firstName:    'Administrador',
        lastName:     'AURA',
        email:        'admin@infotec.com',
        passwordHash: adminHash,
        jobTitle:     'Administrador del Sistema',
        isActive:     true,
        isEmailVerified: true,
      },
    });
    console.log('Usuario admin creado: admin@infotec.com / Admin@2024!');
  }

  console.log('\nSeed completado exitosamente.');
  console.log('─────────────────────────────────────────');
  console.log('Credenciales de prueba:');
  console.log('  Admin:           admin@infotec.com / Admin@2024!');
  console.log('  Registro agente: contraseña = Agent@2024!');
  console.log('─────────────────────────────────────────');
}

main()
  .catch((e) => { console.error('Error en seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
