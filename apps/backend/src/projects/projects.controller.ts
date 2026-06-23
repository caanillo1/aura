import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { ProjectsService } from './projects.service';
import { ActivityReportSchedulerService } from './activity-report-scheduler.service';
import { GenerateProjectDto, LoadTemplateDto, AddModulesDto, ProjectFilterDto, UpdateProjectStatusDto, UpdatePhaseDto, UpdateActivityDto, CreateProjectActivityDto, GlobalActivitiesFilterDto, SendActivityReportDto, SaveActivityScheduleDto } from './dto/project.dto';

const IMPL_ROLES = ['admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support'] as const;

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly svc: ProjectsService,
    private readonly scheduler: ActivityReportSchedulerService,
  ) {}

  @Get()
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Listar proyectos' })
  findAll(@GetUser() user: JwtUser, @Query() dto: ProjectFilterDto) {
    return this.svc.findAll(user.companyId, dto);
  }

  @Get('by-service-order/:serviceOrderId')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Módulos y fases del proyecto de una OS' })
  modulesByServiceOrder(@GetUser() user: JwtUser, @Param('serviceOrderId') serviceOrderId: string) {
    return this.svc.modulesByServiceOrder(user.companyId, serviceOrderId);
  }

  @Get(':id')
  @Roles(...IMPL_ROLES, 'client')
  @ApiOperation({ summary: 'Detalle de proyecto con jerarquía completa' })
  findOne(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findOne(user.companyId, id);
  }

  @Patch(':id/status')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Cambiar estado del proyecto' })
  updateStatus(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateProjectStatusDto) {
    return this.svc.updateProjectStatus(user.companyId, id, dto);
  }

  @Post(':id/load-template')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Cargar/reemplazar módulos desde una plantilla' })
  loadTemplate(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: LoadTemplateDto) {
    return this.svc.loadTemplate(user.companyId, id, dto);
  }

  @Post(':id/add-modules')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Agregar módulos desde una plantilla sin borrar los existentes' })
  addModules(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: AddModulesDto) {
    return this.svc.addModules(user.companyId, id, dto);
  }

  @Delete('modules/:moduleId')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Eliminar módulo del proyecto' })
  deleteModule(@GetUser() user: JwtUser, @Param('moduleId') moduleId: string) {
    return this.svc.deleteModule(user.companyId, moduleId);
  }

  @Delete(':id')
  @Roles(...IMPL_ROLES)
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

  @Get('activities/clients')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Clientes con al menos una actividad en el período' })
  getActivityClients(
    @GetUser() user: JwtUser,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.getActivityClients(user.companyId, dateFrom, dateTo);
  }

  @Get('activities/global')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Listado global de actividades no pendientes' })
  getGlobalActivities(@GetUser() user: JwtUser, @Query() dto: GlobalActivitiesFilterDto) {
    return this.svc.getGlobalActivities(user.companyId, dto);
  }

  @Post('activities/send-report')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Enviar reporte de actividades por correo' })
  sendReport(@GetUser() user: JwtUser, @Body() dto: SendActivityReportDto) {
    return this.svc.sendActivitiesReport(user.companyId, {
      recipients: dto.emails.map(email => ({ email, agentIds: dto.agentIds })),
      subject: dto.subject,
      message: dto.message,
      status: dto.status,
      clientId: dto.clientId,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
    });
  }

  @Get('activities/report-schedule')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Obtener configuración de automatización de reporte' })
  getSchedule(@GetUser() user: JwtUser) {
    return this.scheduler.getSchedule(user.companyId);
  }

  @Patch('activities/report-schedule')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Guardar configuración de automatización de reporte' })
  saveSchedule(@GetUser() user: JwtUser, @Body() dto: SaveActivityScheduleDto) {
    return this.scheduler.saveSchedule(user.companyId, dto);
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

  @Delete('activities/:activityId')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Eliminar actividad del plan de trabajo' })
  deleteActivity(@GetUser() user: JwtUser, @Param('activityId') activityId: string) {
    return this.svc.deleteActivity(user.companyId, activityId);
  }

  @Post('activities/bulk-update')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Actualizar estado de múltiples actividades con nota individual por actividad' })
  bulkUpdateActivities(
    @GetUser() user: JwtUser,
    @Body() body: { items: Array<{ activityId: string; status: string; nota?: string; blockedBy?: string }> },
  ) {
    return this.svc.bulkUpdateActivities(user.companyId, user.id, body.items);
  }
}

// Endpoint anidado en service-orders para generar proyecto
import { Controller as NestController } from '@nestjs/common';

@ApiTags('Service Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@NestController('service-orders')
export class GenerateProjectController {
  constructor(private readonly svc: ProjectsService) {}

  @Post(':id/generate-project')
  @Roles('admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support')
  @Permissions('orders.editar')
  @ApiOperation({ summary: 'Generar proyecto desde OS + plantilla' })
  generate(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: GenerateProjectDto) {
    return this.svc.generateFromServiceOrder(user.companyId, id, dto);
  }
}
