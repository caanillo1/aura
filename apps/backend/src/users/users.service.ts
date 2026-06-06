import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate, buildMeta } from '../common/dto/pagination.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, ResetPasswordDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true, email: true, firstName: true, lastName: true,
  userType: true, document: true, jobTitle: true, phone: true,
  isActive: true, isEmailVerified: true, lastLoginAt: true,
  createdAt: true, updatedAt: true,
  role: { select: { id: true, name: true, slug: true } },
  client: { select: { id: true, businessName: true, nit: true } },
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, dto: PaginationDto & { userType?: string; roleSlug?: string }) {
    const { take, skip } = paginate(dto.page, dto.limit);
    const where: any = { companyId };
    if (dto.userType) where.userType = dto.userType;
    if (dto.search) {
      where.OR = [
        { firstName: { contains: dto.search } },
        { lastName:  { contains: dto.search } },
        { email:     { contains: dto.search } },
        { document:  { contains: dto.search } },
      ];
    }
    if (dto.roleSlug) {
      where.role = { slug: dto.roleSlug };
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, select: USER_SELECT, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto.page ?? 1, dto.limit ?? 20) };
  }

  async findOne(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async create(companyId: string, dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (exists) throw new ConflictException('El correo ya está registrado');

    const role = await this.prisma.role.findFirst({ where: { companyId, slug: dto.roleSlug } });
    if (!role) throw new BadRequestException(`Rol '${dto.roleSlug}' no encontrado`);

    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({ where: { id: dto.clientId, companyId } });
      if (!client) throw new BadRequestException('Cliente no encontrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        companyId, roleId: role.id,
        userType: dto.userType, document: dto.document,
        firstName: dto.firstName, lastName: dto.lastName,
        email: dto.email.toLowerCase(), passwordHash,
        jobTitle: dto.jobTitle, phone: dto.phone,
        clientId: dto.clientId ?? null,
      },
      select: USER_SELECT,
    });
  }

  async update(companyId: string, id: string, dto: UpdateUserDto) {
    await this.findOne(companyId, id);

    let roleId: string | undefined;
    if (dto.roleSlug) {
      const role = await this.prisma.role.findFirst({ where: { companyId, slug: dto.roleSlug } });
      if (!role) throw new BadRequestException(`Rol '${dto.roleSlug}' no encontrado`);
      roleId = role.id;
    }

    const { roleSlug, ...rest } = dto;
    return this.prisma.user.update({
      where: { id },
      data: { ...rest, ...(roleId && { roleId }) },
      select: USER_SELECT,
    });
  }

  async toggleStatus(companyId: string, id: string) {
    const user = await this.findOne(companyId, id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: USER_SELECT,
    });
  }

  async resetPassword(companyId: string, id: string, dto: ResetPasswordDto) {
    await this.findOne(companyId, id);
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });
    return { message: 'Contraseña actualizada exitosamente' };
  }
}
