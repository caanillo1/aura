import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFaqTipoDto, UpdateFaqTipoDto, CreateFaqDto, UpdateFaqDto, FaqFilterDto } from './dto/faq.dto';

@Injectable()
export class FaqService {
  constructor(private prisma: PrismaService) {}

  // ── Tipos ────────────────────────────────────────────────────────────────────

  async getTipos(companyId: string) {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT t.id, t.nombre, t.color, t.icono, t.descripcion, t.orden, t.activo,
             COUNT(f.id) AS faqCount
      FROM   FaqTipos t
      LEFT JOIN Faqs f ON f.tipoId = t.id
      WHERE  t.companyId = CONVERT(uniqueidentifier, ${companyId})
      GROUP  BY t.id, t.nombre, t.color, t.icono, t.descripcion, t.orden, t.activo
      ORDER  BY t.orden ASC, t.nombre ASC
    `;
    return rows.map(r => ({ ...r, activo: !!r.activo, _count: { faqs: Number(r.faqCount ?? 0) } }));
  }

  async createTipo(companyId: string, dto: CreateFaqTipoDto) {
    const now = new Date();
    await this.prisma.$executeRaw`
      INSERT INTO FaqTipos (id, companyId, nombre, color, icono, descripcion, orden, activo, createdAt, updatedAt)
      VALUES (NEWID(), CONVERT(uniqueidentifier, ${companyId}), ${dto.nombre},
              ${dto.color ?? null}, ${dto.icono ?? null}, ${dto.descripcion ?? null},
              ${dto.orden ?? 0}, 1, ${now}, ${now})
    `;
    const [row] = await this.prisma.$queryRaw<any[]>`
      SELECT TOP 1 * FROM FaqTipos
      WHERE companyId = CONVERT(uniqueidentifier, ${companyId}) AND nombre = ${dto.nombre}
      ORDER BY createdAt DESC
    `;
    return { ...row, activo: true };
  }

  async updateTipo(companyId: string, id: string, dto: UpdateFaqTipoDto) {
    const existing   = await this.ensureTipo(companyId, id);
    const now        = new Date();
    const nombre     = dto.nombre      ?? existing.nombre;
    const color      = dto.color       !== undefined ? dto.color       : existing.color;
    const icono      = dto.icono       !== undefined ? dto.icono       : existing.icono;
    const descripcion = dto.descripcion !== undefined ? dto.descripcion : existing.descripcion;
    const orden      = dto.orden       ?? existing.orden;
    const activo     = dto.activo      !== undefined ? (dto.activo ? 1 : 0) : (existing.activo ? 1 : 0);

    await this.prisma.$executeRaw`
      UPDATE FaqTipos SET
        nombre = ${nombre}, color = ${color}, icono = ${icono},
        descripcion = ${descripcion}, orden = ${orden}, activo = ${activo},
        updatedAt = ${now}
      WHERE id = CONVERT(uniqueidentifier, ${id})
    `;
    const [updated] = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM FaqTipos WHERE id = CONVERT(uniqueidentifier, ${id})
    `;
    return { ...updated, activo: !!updated.activo };
  }

  async deleteTipo(companyId: string, id: string) {
    await this.ensureTipo(companyId, id);
    const [{ cnt }] = await this.prisma.$queryRaw<{ cnt: number }[]>`
      SELECT COUNT(*) AS cnt FROM Faqs WHERE tipoId = CONVERT(uniqueidentifier, ${id})
    `;
    if (Number(cnt) > 0)
      throw new ForbiddenException(`El tipo tiene ${cnt} FAQ(s) asociados. Elimínalos o cámbiales el tipo primero.`);
    await this.prisma.$executeRaw`DELETE FROM FaqTipos WHERE id = CONVERT(uniqueidentifier, ${id})`;
    return { message: 'Tipo eliminado' };
  }

  // ── FAQs ─────────────────────────────────────────────────────────────────────

  async getFaqs(companyId: string, filter: FaqFilterDto) {
    let rows: any[] = await this.prisma.$queryRaw`
      SELECT f.id, f.titulo, f.descripcion, f.contenido, f.etiquetas, f.vistas, f.activo,
             f.createdAt, f.updatedAt,
             t.id AS tipoId, t.nombre AS tipoNombre, t.color AS tipoColor, t.icono AS tipoIcono,
             u.id AS autorId, u.firstName, u.lastName
      FROM   Faqs f
      LEFT JOIN FaqTipos t ON t.id = f.tipoId
      LEFT JOIN Usuarios  u ON u.id = f.autorId
      WHERE  f.companyId = CONVERT(uniqueidentifier, ${companyId})
      ORDER  BY f.updatedAt DESC
    `;

    if (filter.soloActivos !== false) rows = rows.filter(r => r.activo);
    if (filter.tipoId) {
      rows = rows.filter(r => r.tipoId?.toString().toLowerCase() === filter.tipoId!.toLowerCase());
    }
    return rows.map(r => this.mapListItem(r));
  }

  async getFaq(companyId: string, id: string) {
    const [row] = await this.prisma.$queryRaw<any[]>`
      SELECT f.*,
             t.id AS tipoId, t.nombre AS tipoNombre, t.color AS tipoColor, t.icono AS tipoIcono,
             u.id AS autorId, u.firstName, u.lastName
      FROM   Faqs f
      LEFT JOIN FaqTipos t ON t.id = f.tipoId
      LEFT JOIN Usuarios  u ON u.id = f.autorId
      WHERE  f.id = CONVERT(uniqueidentifier, ${id})
        AND  f.companyId = CONVERT(uniqueidentifier, ${companyId})
    `;
    if (!row) throw new NotFoundException('FAQ no encontrado');
    await this.prisma.$executeRaw`
      UPDATE Faqs SET vistas = vistas + 1 WHERE id = CONVERT(uniqueidentifier, ${id})
    `;
    return { ...this.mapListItem(row), contenido: row.contenido };
  }

  async createFaq(companyId: string, autorId: string, dto: CreateFaqDto) {
    const now       = new Date();
    const titulo    = dto.titulo;
    const desc      = dto.descripcion ?? null;
    const contenido = dto.contenido;
    const etiquetas = dto.etiquetas?.length ? JSON.stringify(dto.etiquetas) : null;

    if (dto.tipoId) {
      await this.prisma.$executeRaw`
        INSERT INTO Faqs (id, companyId, tipoId, titulo, descripcion, contenido, etiquetas, autorId, activo, vistas, createdAt, updatedAt)
        VALUES (NEWID(), CONVERT(uniqueidentifier, ${companyId}), CONVERT(uniqueidentifier, ${dto.tipoId}),
                ${titulo}, ${desc}, ${contenido}, ${etiquetas},
                CONVERT(uniqueidentifier, ${autorId}), 1, 0, ${now}, ${now})
      `;
    } else {
      await this.prisma.$executeRaw`
        INSERT INTO Faqs (id, companyId, tipoId, titulo, descripcion, contenido, etiquetas, autorId, activo, vistas, createdAt, updatedAt)
        VALUES (NEWID(), CONVERT(uniqueidentifier, ${companyId}), NULL,
                ${titulo}, ${desc}, ${contenido}, ${etiquetas},
                CONVERT(uniqueidentifier, ${autorId}), 1, 0, ${now}, ${now})
      `;
    }

    const [newRow] = await this.prisma.$queryRaw<any[]>`
      SELECT TOP 1 id FROM Faqs
      WHERE companyId = CONVERT(uniqueidentifier, ${companyId}) AND titulo = ${titulo}
      ORDER BY createdAt DESC
    `;
    return this.getFaq(companyId, newRow.id.toString());
  }

  async updateFaq(companyId: string, id: string, dto: UpdateFaqDto) {
    const existing   = await this.ensureFaq(companyId, id);
    const now        = new Date();
    const titulo     = dto.titulo      ?? existing.titulo;
    const descripcion = dto.descripcion !== undefined ? dto.descripcion : existing.descripcion;
    const contenido  = dto.contenido   ?? existing.contenido;
    const tipoId     = dto.tipoId      !== undefined ? dto.tipoId     : existing.tipoId?.toString();
    const etiquetas  = dto.etiquetas !== undefined
      ? (dto.etiquetas.length ? JSON.stringify(dto.etiquetas) : null)
      : existing.etiquetas;
    const activo     = dto.activo !== undefined ? (dto.activo ? 1 : 0) : (existing.activo ? 1 : 0);

    if (tipoId) {
      await this.prisma.$executeRaw`
        UPDATE Faqs SET
          titulo = ${titulo}, descripcion = ${descripcion}, contenido = ${contenido},
          tipoId = CONVERT(uniqueidentifier, ${tipoId}),
          etiquetas = ${etiquetas}, activo = ${activo}, updatedAt = ${now}
        WHERE id = CONVERT(uniqueidentifier, ${id})
      `;
    } else {
      await this.prisma.$executeRaw`
        UPDATE Faqs SET
          titulo = ${titulo}, descripcion = ${descripcion}, contenido = ${contenido},
          tipoId = NULL,
          etiquetas = ${etiquetas}, activo = ${activo}, updatedAt = ${now}
        WHERE id = CONVERT(uniqueidentifier, ${id})
      `;
    }
    return this.getFaq(companyId, id);
  }

  async deleteFaq(companyId: string, id: string) {
    await this.ensureFaq(companyId, id);
    await this.prisma.$executeRaw`DELETE FROM Faqs WHERE id = CONVERT(uniqueidentifier, ${id})`;
    return { message: 'FAQ eliminado' };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async ensureTipo(companyId: string, id: string) {
    const [row] = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM FaqTipos
      WHERE id = CONVERT(uniqueidentifier, ${id})
        AND companyId = CONVERT(uniqueidentifier, ${companyId})
    `;
    if (!row) throw new NotFoundException('Tipo FAQ no encontrado');
    return row;
  }

  private async ensureFaq(companyId: string, id: string) {
    const [row] = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM Faqs
      WHERE id = CONVERT(uniqueidentifier, ${id})
        AND companyId = CONVERT(uniqueidentifier, ${companyId})
    `;
    if (!row) throw new NotFoundException('FAQ no encontrado');
    return row;
  }

  private stripHtml(html: string): string {
    return (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private mapListItem(r: any) {
    return {
      id:              r.id?.toString(),
      titulo:          r.titulo,
      descripcion:     r.descripcion,
      etiquetas:       r.etiquetas,
      contenidoTexto:  this.stripHtml(r.contenido ?? ''),
      vistas:          Number(r.vistas ?? 0),
      activo:          !!r.activo,
      createdAt:       r.createdAt,
      updatedAt:       r.updatedAt,
      tipo:  r.tipoId  ? { id: r.tipoId.toString(),  nombre: r.tipoNombre, color: r.tipoColor, icono: r.tipoIcono } : null,
      autor: r.autorId ? { id: r.autorId.toString(), firstName: r.firstName, lastName: r.lastName } : null,
    };
  }
}
