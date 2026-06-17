import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, buildMeta } from '../common/dto/pagination.dto';
import { CreateMunicipioDto, UpdateMunicipioDto, MunicipioFilterDto } from './dto/municipio.dto';

@Injectable()
export class MunicipiosService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, dto: MunicipioFilterDto) {
    const { take, skip } = paginate(dto.page, dto.limit);
    const where: any = { companyId };
    if (dto.search) {
      where.OR = [
        { nombreMunicipio:    { contains: dto.search } },
        { nombreDepartamento: { contains: dto.search } },
        { codigoMunicipio:    { contains: dto.search } },
        { codigoDepartamento: { contains: dto.search } },
        { codigoPostal:       { contains: dto.search } },
      ];
    }
    if (dto.departamento) where.codigoDepartamento = dto.departamento;

    const [data, total] = await Promise.all([
      this.prisma.municipio.findMany({
        where, skip, take,
        orderBy: [{ nombreDepartamento: 'asc' }, { nombreMunicipio: 'asc' }],
      }),
      this.prisma.municipio.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto.page ?? 1, dto.limit ?? 50) };
  }

  async findAllList(companyId: string) {
    return this.prisma.municipio.findMany({
      where: { companyId },
      orderBy: [{ nombreDepartamento: 'asc' }, { nombreMunicipio: 'asc' }],
    });
  }

  async findPublicCatalog() {
    return this.prisma.municipio.findMany({
      distinct: ['nombreDepartamento', 'nombreMunicipio'],
      orderBy: [{ nombreDepartamento: 'asc' }, { nombreMunicipio: 'asc' }],
      select: {
        id: true,
        nombreMunicipio: true,
        nombreDepartamento: true,
        codigoMunicipio: true,
        codigoDepartamento: true,
        codigoPostal: true,
      },
    });
  }

  async create(companyId: string, dto: CreateMunicipioDto) {
    const exists = await this.prisma.municipio.findUnique({
      where: { companyId_codigoDepartamento_codigoMunicipio: { companyId, codigoDepartamento: dto.codigoDepartamento.trim(), codigoMunicipio: dto.codigoMunicipio.trim() } },
    });
    if (exists) throw new ConflictException(`Ya existe un municipio con código ${dto.codigoDepartamento}-${dto.codigoMunicipio}`);

    return this.prisma.municipio.create({
      data: { companyId, ...dto, codigoDepartamento: dto.codigoDepartamento.trim(), codigoMunicipio: dto.codigoMunicipio.trim() },
    });
  }

  async update(companyId: string, id: string, dto: UpdateMunicipioDto) {
    const mun = await this.prisma.municipio.findFirst({ where: { id, companyId } });
    if (!mun) throw new NotFoundException('Municipio no encontrado');

    const newDep = dto.codigoDepartamento?.trim() ?? mun.codigoDepartamento;
    const newMun = dto.codigoMunicipio?.trim()    ?? mun.codigoMunicipio;
    if (newDep !== mun.codigoDepartamento || newMun !== mun.codigoMunicipio) {
      const exists = await this.prisma.municipio.findUnique({
        where: { companyId_codigoDepartamento_codigoMunicipio: { companyId, codigoDepartamento: newDep, codigoMunicipio: newMun } },
      });
      if (exists) throw new ConflictException(`Ya existe un municipio con código ${newDep}-${newMun}`);
    }

    return this.prisma.municipio.update({ where: { id }, data: dto });
  }

  async delete(companyId: string, id: string) {
    const mun = await this.prisma.municipio.findFirst({ where: { id, companyId } });
    if (!mun) throw new NotFoundException('Municipio no encontrado');

    const clientCount = await this.prisma.client.count({ where: { municipioId: id } });
    if (clientCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar "${mun.nombreMunicipio}" porque tiene ${clientCount} cliente(s) asignado(s).`,
      );
    }

    await this.prisma.municipio.delete({ where: { id } });
    return { message: `Municipio "${mun.nombreMunicipio}" eliminado` };
  }

  async bulkCreate(companyId: string, items: CreateMunicipioDto[]) {
    // Pre-filtrar ítems con campos obligatorios vacíos para no fallar el lote completo
    const validos = items.filter(i =>
      i.codigoDepartamento?.trim() && i.nombreDepartamento?.trim() &&
      i.codigoMunicipio?.trim()    && i.nombreMunicipio?.trim(),
    );
    const invalidos = items.filter(i =>
      !i.codigoDepartamento?.trim() || !i.nombreDepartamento?.trim() ||
      !i.codigoMunicipio?.trim()    || !i.nombreMunicipio?.trim(),
    );

    // 1 query: traer combinaciones dep+mun existentes
    const incomingCodes = validos.map(i => i.codigoMunicipio.trim());
    const existing = await this.prisma.municipio.findMany({
      where: { companyId, codigoMunicipio: { in: incomingCodes } },
      select: { codigoDepartamento: true, codigoMunicipio: true },
    });
    const existingSet = new Set(existing.map(e => `${e.codigoDepartamento}|${e.codigoMunicipio}`));

    const nuevos: CreateMunicipioDto[] = [];
    const duplicados: CreateMunicipioDto[] = [];
    const seenInBatch = new Set<string>();

    for (const item of validos) {
      const key = `${item.codigoDepartamento.trim()}|${item.codigoMunicipio.trim()}`;
      if (existingSet.has(key) || seenInBatch.has(key)) {
        duplicados.push(item);
      } else {
        nuevos.push(item);
        seenInBatch.add(key);
      }
    }

    // 1 query: insertar todos los nuevos en batch
    if (nuevos.length > 0) {
      await this.prisma.municipio.createMany({
        data: nuevos.map(item => ({
          companyId,
          codigoDepartamento: item.codigoDepartamento,
          nombreDepartamento: item.nombreDepartamento,
          codigoMunicipio:    item.codigoMunicipio.trim(),
          nombreMunicipio:    item.nombreMunicipio,
          codigoPostal:       item.codigoPostal || null,
        })),
      });
    }

    const resultados: { codigo: string; nombre: string; ok: boolean; error?: string }[] = [
      ...nuevos.map(item => ({ codigo: item.codigoMunicipio, nombre: item.nombreMunicipio, ok: true })),
      ...duplicados.map(item => ({ codigo: item.codigoMunicipio, nombre: item.nombreMunicipio, ok: false, error: `Ya existe un municipio con código ${item.codigoMunicipio}` })),
      ...invalidos.map(item => ({ codigo: item.codigoMunicipio ?? '', nombre: item.nombreMunicipio ?? '', ok: false, error: 'Faltan campos obligatorios (código/nombre departamento o municipio)' })),
    ];

    return {
      exitosos: nuevos.length,
      fallidos:  duplicados.length + invalidos.length,
      resultados,
    };
  }
}
