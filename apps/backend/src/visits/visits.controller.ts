import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { VisitsService } from './visits.service';
import { CreateVisitDto, UpdateVisitDto, FilterVisitDto } from './dto/visit.dto';

const IMPL_ROLES = ['admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support'] as const;

@ApiTags('Visits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('visits')
export class VisitsController {
  constructor(private readonly svc: VisitsService) {}

  @Get()
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Listar visitas — filtra por projectId, status, rango de fechas' })
  findAll(@GetUser() user: JwtUser, @Query() dto: FilterVisitDto) {
    return this.svc.findAll(user.companyId, dto);
  }

  @Get(':id')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Detalle de visita' })
  findOne(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findOne(user.companyId, id);
  }

  @Post()
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Crear visita' })
  create(@GetUser() user: JwtUser, @Body() dto: CreateVisitDto) {
    return this.svc.create(user.companyId, user.id, dto);
  }

  @Patch(':id')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Actualizar visita' })
  update(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateVisitDto) {
    return this.svc.update(user.companyId, id, dto);
  }

  @Delete(':id')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Eliminar visita' })
  remove(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.remove(user.companyId, id);
  }
}
