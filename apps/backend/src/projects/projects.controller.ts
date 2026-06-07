import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { ProjectsService } from './projects.service';
import { GenerateProjectDto, LoadTemplateDto, ProjectFilterDto, UpdateProjectStatusDto, UpdatePhaseDto, UpdateActivityDto, CreateProjectActivityDto } from './dto/project.dto';

const IMPL_ROLES = ['admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support'] as const;

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Get()
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Listar proyectos' })
  findAll(@GetUser() user: JwtUser, @Query() dto: ProjectFilterDto) {
    return this.svc.findAll(user.companyId, dto);
  }

  @Get(':id')
  @Roles(...IMPL_ROLES, 'client')
  @ApiOperation({ summary: 'Detalle de proyecto con jerarquía completa' })
  findOne(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findOne(user.companyId, id);
  }

  @Patch(':id/status')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Cambiar estado del proyecto' })
  updateStatus(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateProjectStatusDto) {
    return this.svc.updateProjectStatus(user.companyId, id, dto);
  }

  @Post(':id/load-template')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Cargar/reemplazar módulos desde una plantilla' })
  loadTemplate(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: LoadTemplateDto) {
    return this.svc.loadTemplate(user.companyId, id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Eliminar proyecto' })
  deleteProject(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.deleteProject(user.companyId, id);
  }

  @Patch('phases/:phaseId')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Actualizar fase (estado, fechas)' })
  updatePhase(@GetUser() user: JwtUser, @Param('phaseId') phaseId: string, @Body() dto: UpdatePhaseDto) {
    return this.svc.updatePhase(user.companyId, phaseId, dto);
  }

  @Patch('activities/:activityId')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Actualizar actividad (estado, progreso, horas, novedades)' })
  updateActivity(@GetUser() user: JwtUser, @Param('activityId') activityId: string, @Body() dto: UpdateActivityDto) {
    return this.svc.updateActivity(user.companyId, activityId, dto);
  }

  @Post('phases/:phaseId/activities')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Agregar actividad a una fase de proyecto' })
  addActivity(@GetUser() user: JwtUser, @Param('phaseId') phaseId: string, @Body() dto: CreateProjectActivityDto) {
    return this.svc.addPhaseActivity(user.companyId, phaseId, dto);
  }
}

// Endpoint anidado en service-orders para generar proyecto
import { Controller as NestController } from '@nestjs/common';

@ApiTags('Service Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@NestController('service-orders')
export class GenerateProjectController {
  constructor(private readonly svc: ProjectsService) {}

  @Post(':id/generate-project')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Generar proyecto desde OS + plantilla' })
  generate(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: GenerateProjectDto) {
    return this.svc.generateFromServiceOrder(user.companyId, id, dto);
  }
}
