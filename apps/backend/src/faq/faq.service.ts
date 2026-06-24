import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFaqTipoDto, UpdateFaqTipoDto, CreateFaqDto, UpdateFaqDto, FaqFilterDto } from './dto/faq.dto';

@Injectable()
export class FaqService {
  constructor(private prisma: PrismaService) {}

  // ── Tipos ────────────────────────────────────────────────────────────────────

  async getTipos(companyId: string) {
    return this.prisma.faqTipo.findMany({
      where: { companyId },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, color: true, icono: true, descripcion: true, orden: true, activo: true, _count: { select: { faqs: true } } },
    });
  }

  async createTipo(companyId: string, dto: CreateFaqTipoDto) {
    return this.prisma.faqTipo.create({
      data: { companyId, ...dto },
    });
  }

  async updateTipo(companyId: string, id: string, dto: UpdateFaqTipoDto) {
    await this.ensureTipo(companyId, id);
    return this.prisma.faqTipo.update({ where: { id }, data: dto });
  }

  async deleteTipo(companyId: string, id: string) {
    await this.ensureTipo(companyId, id);
    const count = await this.prisma.faq.count({ where: { tipoId: id } });
    if (count > 0) throw new ForbiddenException(`El tipo tiene ${count} FAQ(s) asociados. Elimínalos o cámbiales el tipo primero.`);
    await this.prisma.faqTipo.delete({ where: { id } });
    return { message: 'Tipo eliminado' };
  }

  // ── FAQs ─────────────────────────────────────────────────────────────────────

  async getFaqs(companyId: string, filter: FaqFilterDto) {
    const where: any = { companyId };
    if (filter.soloActivos !== false) where.activo = true;
    if (filter.tipoId)                where.tipoId = filter.tipoId;
    if (filter.q) {
      where.OR = [
        { titulo:      { contains: filter.q } },
        { descripcion: { contains: filter.q } },
        { etiquetas:   { contains: filter.q } },
      ];
    }
    return this.prisma.faq.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, titulo: true, descripcion: true, etiquetas: true, vistas: true,
        activo: true, createdAt: true, updatedAt: true,
        tipo:  { select: { id: true, nombre: true, color: true, icono: true } },
        autor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getFaq(companyId: string, id: string) {
    const faq = await this.prisma.faq.findFirst({
      where: { id, companyId },
      include: {
        tipo:  { select: { id: true, nombre: true, color: true, icono: true } },
        autor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!faq) throw new NotFoundException('FAQ no encontrado');
    // Incrementar vistas
    await this.prisma.faq.update({ where: { id }, data: { vistas: { increment: 1 } } });
    return faq;
  }

  async createFaq(companyId: string, autorId: string, dto: CreateFaqDto) {
    const { etiquetas, ...rest } = dto;
    return this.prisma.faq.create({
      data: {
        companyId, autorId, ...rest,
        etiquetas: etiquetas ? JSON.stringify(etiquetas) : null,
      },
      include: { tipo: true, autor: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async updateFaq(companyId: string, id: string, dto: UpdateFaqDto) {
    await this.ensureFaq(companyId, id);
    const { etiquetas, ...rest } = dto;
    return this.prisma.faq.update({
      where: { id },
      data: { ...rest, ...(etiquetas !== undefined ? { etiquetas: JSON.stringify(etiquetas) } : {}) },
      include: { tipo: true, autor: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async deleteFaq(companyId: string, id: string) {
    await this.ensureFaq(companyId, id);
    await this.prisma.faq.delete({ where: { id } });
    return { message: 'FAQ eliminado' };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async ensureTipo(companyId: string, id: string) {
    const row = await this.prisma.faqTipo.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Tipo FAQ no encontrado');
    return row;
  }

  private async ensureFaq(companyId: string, id: string) {
    const row = await this.prisma.faq.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('FAQ no encontrado');
    return row;
  }
}
