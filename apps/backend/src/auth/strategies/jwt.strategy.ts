import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    // Usar process.env directamente — ConfigService no está disponible en el constructor
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'aura_erp_jwt_fallback_2024',
      ignoreExpiration: false,
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesión inválida');
    }

    let permissions: string[] = [];
    if (user.role.permissions) {
      try { permissions = JSON.parse(user.role.permissions as string) as string[]; } catch {}
    }

    return {
      id: user.id,
      email: user.email,
      userType: user.userType,
      role: user.role.slug,
      companyId: user.companyId,
      permissions,
    };
  }
}
