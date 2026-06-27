import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { InformesService } from './informes.service';

const IMPL_ROLES = ['admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support'] as const;

@ApiTags('informes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('informes')
export class InformesController {
  constructor(private readonly svc: InformesService) {}

  @Get('snapshots')
  @Roles(...IMPL_ROLES)
  list(@GetUser() user: JwtUser) {
    return this.svc.listSnapshots(user.companyId);
  }

  @Get('snapshots/:id')
  @Roles(...IMPL_ROLES)
  get(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.getSnapshot(id, user.companyId);
  }

  @Post('snapshots')
  @Roles(...IMPL_ROLES)
  create(@GetUser() user: JwtUser, @Body() body: {
    titulo: string;
    fechaCorte: string;
    datos: any[];
    observaciones?: string;
    recomendaciones?: string;
  }) {
    return this.svc.createSnapshot(user.companyId, user.id, body);
  }

  @Delete('snapshots/:id')
  @Roles(...IMPL_ROLES)
  remove(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.deleteSnapshot(id, user.companyId);
  }

  @Post('generar-analisis')
  @Roles(...IMPL_ROLES)
  generarAnalisis(@GetUser() user: JwtUser) {
    return this.svc.generarAnalisis(user.companyId);
  }
}
