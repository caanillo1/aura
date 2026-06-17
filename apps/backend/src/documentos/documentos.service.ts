import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTipoDocumentoDto, UpdateTipoDocumentoDto, UploadArchivoDto, ArchivoFilterDto } from './dto/documento.dto';
import * as fs from 'fs';
import * as path from 'path';
import type { Response } from 'express';

@Injectable()
export class DocumentosService {
  constructor(private prisma: PrismaService) {}

  // ── Tipos de Documento ───────────────────────────────────────────────────

  async findAllTipos(companyId: string) {
    return this.prisma.tipoDocumento.findMany({
      where: { companyId },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: { _count: { select: { archivos: true } } },
    });
  }

  async createTipo(companyId: string, dto: CreateTipoDocumentoDto) {
    const exists = await this.prisma.tipoDocumento.findUnique({
      where: { companyId_nombre: { companyId, nombre: dto.nombre.trim() } },
    });
    if (exists) throw new ConflictException(`Ya existe un tipo llamado "${dto.nombre}"`);

    return this.prisma.tipoDocumento.create({
      data: { companyId, nombre: dto.nombre.trim(), descripcion: dto.descripcion, color: dto.color ?? '#60a5fa', scope: dto.scope ?? 'ambos', orden: dto.orden ?? 0 },
    });
  }

  async updateTipo(companyId: string, id: string, dto: UpdateTipoDocumentoDto) {
    const tipo = await this.prisma.tipoDocumento.findFirst({ where: { id, companyId } });
    if (!tipo) throw new NotFoundException('Tipo de documento no encontrado');

    if (dto.nombre && dto.nombre.trim() !== tipo.nombre) {
      const dup = await this.prisma.tipoDocumento.findUnique({
        where: { companyId_nombre: { companyId, nombre: dto.nombre.trim() } },
      });
      if (dup) throw new ConflictException(`Ya existe un tipo llamado "${dto.nombre}"`);
    }

    return this.prisma.tipoDocumento.update({
      where: { id },
      data: { ...dto, ...(dto.nombre && { nombre: dto.nombre.trim() }) },
    });
  }

  async deleteTipo(companyId: string, id: string) {
    const tipo = await this.prisma.tipoDocumento.findFirst({
      where: { id, companyId },
      include: { _count: { select: { archivos: true } } },
    });
    if (!tipo) throw new NotFoundException('Tipo de documento no encontrado');
    if ((tipo as any)._count.archivos > 0) {
      throw new BadRequestException(
        `No se puede eliminar "${tipo.nombre}" porque tiene ${(tipo as any)._count.archivos} archivo(s) asociado(s). Desactívalo en su lugar.`,
      );
    }
    await this.prisma.tipoDocumento.delete({ where: { id } });
    return { ok: true };
  }

  // ── Archivos ─────────────────────────────────────────────────────────────

  async findAll(companyId: string, dto: ArchivoFilterDto) {
    const where: any = { companyId };
    const and: any[] = [];

    if (dto.tipoDocumentoId) where.tipoDocumentoId = dto.tipoDocumentoId;
    if (dto.serviceOrderId)  where.serviceOrderId  = dto.serviceOrderId;
    if (dto.esInterno !== undefined) where.esInterno = dto.esInterno;

    if (dto.fechaDesde || dto.fechaHasta) {
      const createdAt: any = {};
      if (dto.fechaDesde) createdAt.gte = new Date(dto.fechaDesde);
      if (dto.fechaHasta) createdAt.lte = new Date(dto.fechaHasta + 'T23:59:59.999Z');
      and.push({ createdAt });
    }

    // Documentos del cliente: directamente vinculados O a través de una OS del cliente
    if (dto.clientId) {
      and.push({
        OR: [
          { clientId: dto.clientId },
          { serviceOrder: { clientId: dto.clientId } },
        ],
      });
    }

    if (dto.search) {
      and.push({
        OR: [
          { nombre:         { contains: dto.search } },
          { descripcion:    { contains: dto.search } },
          { nombreOriginal: { contains: dto.search } },
        ],
      });
    }

    if (and.length > 0) where.AND = and;

    const take = dto.limit ?? 50;
    const skip = ((dto.page ?? 1) - 1) * take;

    const [data, total] = await Promise.all([
      this.prisma.archivo.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          tipoDocumento: { select: { id: true, nombre: true, color: true } },
          client:        { select: { id: true, businessName: true, nit: true } },
          serviceOrder:  { select: { id: true, osNumber: true, product: true, client: { select: { businessName: true } } } },
          subidoPor:     { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.archivo.count({ where }),
    ]);

    return { data, meta: { total, page: dto.page ?? 1, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async upload(companyId: string, userId: string, file: Express.Multer.File, dto: UploadArchivoDto) {
    const tipo = await this.prisma.tipoDocumento.findFirst({ where: { id: dto.tipoDocumentoId, companyId, activo: true } });
    if (!tipo) throw new NotFoundException('Tipo de documento no encontrado o inactivo');

    return this.prisma.archivo.create({
      data: {
        companyId,
        tipoDocumentoId: dto.tipoDocumentoId,
        nombre:          dto.nombre?.trim() || file.originalname,
        descripcion:     dto.descripcion || null,
        nombreOriginal:  file.originalname,
        mimeType:        file.mimetype,
        tamanioBytes:    file.size,
        ruta:            file.path,
        clientId:        dto.clientId        || null,
        serviceOrderId:  dto.serviceOrderId  || null,
        esInterno:       dto.esInterno       ?? false,
        subidoPorId:     userId,
      },
      include: {
        tipoDocumento: { select: { id: true, nombre: true, color: true } },
        client:        { select: { id: true, businessName: true } },
        serviceOrder:  { select: { id: true, osNumber: true, product: true, client: { select: { businessName: true } } } },
        subidoPor:     { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async download(companyId: string, id: string, res: Response) {
    const archivo = await this.prisma.archivo.findFirst({ where: { id, companyId } });
    if (!archivo) throw new NotFoundException('Archivo no encontrado');

    if (!fs.existsSync(archivo.ruta)) {
      throw new InternalServerErrorException('El archivo no se encontró en el servidor');
    }

    res.download(archivo.ruta, archivo.nombreOriginal);
  }

  async remove(companyId: string, id: string) {
    const archivo = await this.prisma.archivo.findFirst({ where: { id, companyId } });
    if (!archivo) throw new NotFoundException('Archivo no encontrado');

    await this.prisma.archivo.delete({ where: { id } });

    if (fs.existsSync(archivo.ruta)) {
      try { fs.unlinkSync(archivo.ruta); } catch { /* ignorar si falla borrado de disco */ }
    }

    return { ok: true };
  }
}
