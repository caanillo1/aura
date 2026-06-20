import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCotizacionDto, UpdateCotizacionDto, CotizacionFilterDto } from './dto/comercial.dto';

@Injectable()
export class ComercialService {
  constructor(private prisma: PrismaService) {}

  private readonly listSelect = {
    id: true, numero: true, titulo: true, status: true, valor: true,
    validHasta: true, createdAt: true, prospecto: true, contacto: true, email: true,
    descripcion: true, notas: true,
    client: { select: { id: true, businessName: true } },
    createdBy: { select: { firstName: true, lastName: true } },
  } as const;

  private readonly detailSelect = {
    id: true, numero: true, titulo: true, status: true, valor: true,
    validHasta: true, createdAt: true, prospecto: true, contacto: true, email: true,
    descripcion: true, notas: true,
    client:    { select: { id: true, businessName: true } },
    createdBy: { select: { firstName: true, lastName: true } },
    items:     { select: { id: true, descripcion: true, cantidad: true, valorUnitario: true, descuento: true } },
  } as const;

  private async nextNumero(companyId: string): Promise<string> {
    const last = await this.prisma.cotizacion.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { numero: true },
    });
    if (!last) return 'COT-0001';
    const n = parseInt(last.numero.replace('COT-', ''), 10) || 0;
    return `COT-${String(n + 1).padStart(4, '0')}`;
  }

  private calcValor(items: { cantidad: number; valorUnitario: number; descuento?: number }[]) {
    return items.reduce((s, i) => s + i.cantidad * i.valorUnitario * (1 - (i.descuento ?? 0) / 100), 0);
  }

  async findAll(companyId: string, filters: CotizacionFilterDto) {
    return this.prisma.cotizacion.findMany({
      where: {
        companyId,
        ...(filters.status   && { status: filters.status }),
        ...(filters.clientId && { clientId: filters.clientId }),
        ...(filters.search   && {
          OR: [
            { titulo:    { contains: filters.search } },
            { numero:    { contains: filters.search } },
            { prospecto: { contains: filters.search } },
          ],
        }),
      },
      select: this.listSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const c = await this.prisma.cotizacion.findFirst({ where: { id, companyId }, select: this.detailSelect });
    if (!c) throw new NotFoundException('Cotización no encontrada');
    return c;
  }

  async create(companyId: string, userId: string, dto: CreateCotizacionDto) {
    const numero = await this.nextNumero(companyId);
    const items = dto.items ?? [];
    const valor = items.length > 0 ? this.calcValor(items) : undefined;
    return this.prisma.cotizacion.create({
      data: {
        companyId, numero, titulo: dto.titulo,
        clientId:    dto.clientId ?? null,
        prospecto:   dto.prospecto ?? null,
        contacto:    dto.contacto ?? null,
        email:       dto.email ?? null,
        descripcion: dto.descripcion ?? null,
        notas:       dto.notas ?? null,
        validHasta:  dto.validHasta ? new Date(dto.validHasta) : null,
        status:      dto.status ?? 'borrador',
        valor:       valor ?? null,
        createdById: userId,
        items:       items.length > 0 ? { create: items } : undefined,
      },
      select: this.detailSelect,
    });
  }

  async update(companyId: string, id: string, dto: UpdateCotizacionDto) {
    await this.findOne(companyId, id);
    const items = dto.items;
    const valor = items && items.length > 0 ? this.calcValor(items) : undefined;
    return this.prisma.cotizacion.update({
      where: { id },
      data: {
        ...(dto.titulo      !== undefined && { titulo: dto.titulo }),
        ...(dto.status      !== undefined && { status: dto.status }),
        ...(dto.clientId    !== undefined && { clientId: dto.clientId }),
        ...(dto.prospecto   !== undefined && { prospecto: dto.prospecto }),
        ...(dto.contacto    !== undefined && { contacto: dto.contacto }),
        ...(dto.email       !== undefined && { email: dto.email }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(dto.notas       !== undefined && { notas: dto.notas }),
        ...(dto.validHasta  !== undefined && { validHasta: dto.validHasta ? new Date(dto.validHasta) : null }),
        ...(valor           !== undefined && { valor }),
        ...(items && {
          items: {
            deleteMany: {},
            create: items,
          },
        }),
      },
      select: this.detailSelect,
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    await this.prisma.cotizacion.delete({ where: { id } });
    return { ok: true };
  }
}
