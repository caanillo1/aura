import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InformesService {
  constructor(private prisma: PrismaService) {}

  async listSnapshots(companyId: string) {
    const snapshots = await this.prisma.informeEjecutivoSnapshot.findMany({
      where: { companyId },
      select: {
        id: true, titulo: true, fechaCorte: true, createdAt: true,
        creadoPor: { select: { firstName: true, lastName: true } },
      },
      orderBy: { fechaCorte: 'desc' },
    });
    return snapshots.map(s => ({
      id: s.id,
      titulo: s.titulo,
      fechaCorte: s.fechaCorte,
      createdAt: s.createdAt,
      creadoPor: `${s.creadoPor.firstName} ${s.creadoPor.lastName}`,
    }));
  }

  async getSnapshot(id: string, companyId: string) {
    const snap = await this.prisma.informeEjecutivoSnapshot.findFirst({
      where: { id, companyId },
    });
    if (!snap) throw new NotFoundException('Snapshot no encontrado');
    return {
      id: snap.id,
      titulo: snap.titulo,
      fechaCorte: snap.fechaCorte,
      createdAt: snap.createdAt,
      datos: JSON.parse(snap.datos),
      observaciones: snap.observaciones ?? '',
      recomendaciones: snap.recomendaciones ?? '',
    };
  }

  async createSnapshot(companyId: string, userId: string, body: {
    titulo: string;
    fechaCorte: string;
    datos: any[];
    observaciones?: string;
    recomendaciones?: string;
  }) {
    const snap = await this.prisma.informeEjecutivoSnapshot.create({
      data: {
        companyId,
        creadoPorId: userId,
        titulo: body.titulo,
        fechaCorte: new Date(body.fechaCorte),
        datos: JSON.stringify(body.datos),
        observaciones: body.observaciones ?? null,
        recomendaciones: body.recomendaciones ?? null,
      },
    });
    return { id: snap.id, titulo: snap.titulo, createdAt: snap.createdAt };
  }

  async deleteSnapshot(id: string, companyId: string) {
    await this.prisma.informeEjecutivoSnapshot.deleteMany({ where: { id, companyId } });
    return { ok: true };
  }
}
