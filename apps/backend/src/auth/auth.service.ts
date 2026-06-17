import {
  Injectable, UnauthorizedException, ConflictException,
  BadRequestException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // ── LOGIN ────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { role: true, company: true },
    });

    if (!user) throw new UnauthorizedException('Credenciales incorrectas');
    if (!user.isActive) throw new UnauthorizedException('Usuario desactivado');

    // Verificar bloqueo por intentos fallidos
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Cuenta bloqueada temporalmente. Intenta más tarde');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatch) {
      // Incrementar contador de fallos
      const failCount = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failCount,
          lockedUntil: failCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // Resetear fallos en login exitoso
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role.slug);

    // Guardar hash del refresh token
    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: refreshHash },
    });

    this.logger.log(`Login exitoso: ${user.email}`);

    let permissions: string[] = [];
    if (user.role.permissions) {
      try { permissions = JSON.parse(user.role.permissions as string) as string[]; } catch {}
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        role: user.role.slug,
        roleName: user.role.name,
        companyId: user.companyId,
        companyName: user.company?.name,
        permissions,
      },
      ...tokens,
    };
  }

  // ── REGISTER ─────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    // Verificar email único
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (exists) throw new ConflictException('El correo ya está registrado');

    // Obtener empresa (por ahora usa la primera empresa activa)
    const company = await this.prisma.company.findFirst({
      where: { isActive: true },
    });
    if (!company) throw new BadRequestException('No hay empresa configurada en el sistema');

    // Validar contraseña de agente si aplica
    if (dto.userType === 'agent') {
      if (!dto.agentRegPassword) {
        throw new BadRequestException('Se requiere la contraseña de registro para agentes');
      }
      const agentPassMatch = await bcrypt.compare(dto.agentRegPassword, company.agentRegPassword);
      if (!agentPassMatch) {
        throw new UnauthorizedException('Contraseña de registro de agente incorrecta');
      }
    }

    // Para clientes: buscar por ID, buscar por NIT, o crear nueva empresa
    let clientId: string | null = null;
    if (dto.userType === 'client') {
      if (dto.clientId) {
        // Caso 1: empresa por ID directo
        const existing = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
        if (!existing) throw new BadRequestException('La empresa cliente no existe');
        clientId = existing.id;

      } else if (dto.companyNit && !dto.companyBusinessName) {
        // Caso 2: lookup solo por NIT ("ya está registrada")
        const nit = dto.companyNit.trim();
        const existing = await this.prisma.client.findFirst({
          where: { companyId: company.id, nit },
        });
        if (!existing) {
          throw new BadRequestException(
            `No existe ninguna empresa con el NIT ${nit} en el sistema. ` +
            `Usa "Registrar nueva" para crearla.`,
          );
        }
        clientId = existing.id;
        this.logger.log(`Cliente asociado por NIT: ${existing.businessName} (${nit})`);

      } else if (dto.companyNit && dto.companyBusinessName) {
        // Caso 3: crear nueva empresa (o asociar si el NIT ya existe)
        const nit = dto.companyNit.trim();
        const exists = await this.prisma.client.findFirst({
          where: { companyId: company.id, nit },
        });
        if (exists) {
          clientId = exists.id;
          this.logger.log(`NIT ya existente, asociando a: ${exists.businessName} (${nit})`);
        } else {
          const newClient = await this.prisma.client.create({
            data: {
              companyId: company.id,
              nit,
              businessName: dto.companyBusinessName,
              commercialName: dto.companyCommercialName,
              address: dto.companyAddress,
              city: dto.companyCity,
              department: dto.companyDepartment,
              email: dto.companyEmail,
              phone: dto.companyPhone,
              economicActivity: dto.companyEconomicActivity,
            },
          });
          clientId = newClient.id;
          this.logger.log(`Nueva empresa cliente creada: ${newClient.businessName} (${nit})`);
        }
      }
    }

    // Obtener rol por defecto según tipo
    const roleSlug = dto.userType === 'agent' ? 'implementer_clinical' : 'client';
    const role = await this.prisma.role.findFirst({
      where: { companyId: company.id, slug: roleSlug },
    });
    if (!role) throw new BadRequestException(`Rol '${roleSlug}' no encontrado`);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        companyId: company.id,
        roleId: role.id,
        userType: dto.userType,
        document: dto.document,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase(),
        passwordHash,
        jobTitle: dto.jobTitle,
        clientId,
      },
      include: { role: true },
    });

    const tokens = await this.generateTokens(user.id, user.email, role.slug);

    this.logger.log(`Registro exitoso: ${user.email} (${dto.userType})`);

    let permissions: string[] = [];
    if (role.permissions) {
      try { permissions = JSON.parse(role.permissions as string) as string[]; } catch {}
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        role: role.slug,
        roleName: role.name,
        companyId: user.companyId,
        permissions,
      },
      ...tokens,
    };
  }

  // ── REFRESH TOKEN ─────────────────────────────────────────────────────────
  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.refreshTokenHash) throw new UnauthorizedException('Sesión expirada');

    const match = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!match) throw new UnauthorizedException('Token inválido');

    const role = await this.prisma.role.findUnique({ where: { id: user.roleId } });
    const tokens = await this.generateTokens(user.id, user.email, role?.slug ?? 'client');

    const newHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: newHash },
    });

    return tokens;
  }

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { message: 'Sesión cerrada exitosamente' };
  }

  // ── ME (perfil actual) ────────────────────────────────────────────────────
  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        userType: true, jobTitle: true, phone: true, signatureFilePath: true,
        companyId: true, clientId: true, isActive: true, lastLoginAt: true,
        role: { select: { id: true, name: true, slug: true, permissions: true } },
        company: { select: { id: true, name: true, logo: true, primaryColor: true } },
      },
    });
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
