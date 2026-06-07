import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { TemplatesService } from './templates.service';
import {
  CreateTemplateFlowDto, UpdateTemplateFlowDto,
  CreateTemplateModuleDto, UpdateTemplateModuleDto, ReorderDto,
  CreateTemplatePhaseDto, UpdateTemplatePhaseDto,
  CreateTemplateActivityDto, UpdateTemplateActivityDto, CreateActivityThreadDto,
  CreateStandaloneModuleDto,
} from './dto/template.dto';

const IMPL_ROLES = ['admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support'] as const;
const EDIT_ROLES = ['admin', 'coordinator'] as const;

@ApiTags('Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly svc: TemplatesService) {}

  // ── Flows ─────────────────────────────────────────────────────────────────

  @Get()
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Listar plantillas' })
  findAll(@GetUser() user: JwtUser, @Query() dto: PaginationDto) {
    return this.svc.findAll(user.companyId, dto);
  }

  @Get(':id')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Detalle de plantilla con jerarquía completa' })
  findOne(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findOne(user.companyId, id);
  }

  @Post()
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Crear plantilla' })
  create(@GetUser() user: JwtUser, @Body() dto: CreateTemplateFlowDto) {
    return this.svc.create(user.companyId, user.id, dto);
  }

  @Put(':id')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Actualizar plantilla' })
  update(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateTemplateFlowDto) {
    return this.svc.update(user.companyId, id, dto);
  }

  @Delete(':id')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Eliminar plantilla (cascade)' })
  deleteTemplate(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.deleteTemplate(user.companyId, id);
  }

  @Patch(':id/status')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Activar/desactivar plantilla' })
  toggleTemplateStatus(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.toggleTemplateStatus(user.companyId, id);
  }

  @Post(':id/modules/assign')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Asignar módulo existente a la plantilla' })
  assignModule(@GetUser() user: JwtUser, @Param('id') id: string, @Body() body: { moduleId: string }) {
    return this.svc.assignModuleToTemplate(user.companyId, id, body.moduleId);
  }

  // ── Modules — library (global across all templates) ───────────────────────

  @Get('modules/all')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Biblioteca global de módulos (todas las plantillas)' })
  findAllModules(@GetUser() user: JwtUser, @Query() dto: PaginationDto) {
    return this.svc.findAllModules(user.companyId, dto);
  }

  @Post('modules')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Crear módulo independiente (código auto-generado)' })
  createModule(@GetUser() user: JwtUser, @Body() dto: CreateStandaloneModuleDto) {
    return this.svc.createStandaloneModule(user.companyId, dto);
  }

  @Put('modules/:moduleId')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Actualizar módulo por ID' })
  updateModuleById(
    @GetUser() user: JwtUser,
    @Param('moduleId') moduleId: string,
    @Body() dto: UpdateTemplateModuleDto,
  ) {
    return this.svc.updateModuleById(user.companyId, moduleId, dto);
  }

  @Delete('modules/:moduleId')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Eliminar módulo por ID' })
  deleteModuleById(@GetUser() user: JwtUser, @Param('moduleId') moduleId: string) {
    return this.svc.deleteModuleById(user.companyId, moduleId);
  }

  @Patch('modules/:moduleId/status')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Activar/desactivar módulo' })
  toggleModuleStatus(@GetUser() user: JwtUser, @Param('moduleId') moduleId: string) {
    return this.svc.toggleModuleStatus(user.companyId, moduleId);
  }

  // ── Module detail (phases + activities scoped to module) ──────────────────

  @Get('modules/:moduleId/detail')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Detalle de módulo con fases y actividades' })
  getModuleDetail(@GetUser() user: JwtUser, @Param('moduleId') moduleId: string) {
    return this.svc.getModuleDetail(user.companyId, moduleId);
  }

  @Post('modules/:moduleId/phases')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Agregar fase a módulo' })
  addPhaseToModule(@GetUser() user: JwtUser, @Param('moduleId') moduleId: string, @Body() dto: CreateTemplatePhaseDto) {
    return this.svc.addPhaseToModule(user.companyId, moduleId, dto);
  }

  @Put('modules/:moduleId/phases/:phaseId')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Actualizar fase de módulo' })
  updatePhaseInModule(
    @GetUser() user: JwtUser,
    @Param('moduleId') moduleId: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: UpdateTemplatePhaseDto,
  ) {
    return this.svc.updatePhaseInModule(user.companyId, moduleId, phaseId, dto);
  }

  @Delete('modules/:moduleId/phases/:phaseId')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Eliminar fase de módulo' })
  deletePhaseFromModule(
    @GetUser() user: JwtUser,
    @Param('moduleId') moduleId: string,
    @Param('phaseId') phaseId: string,
  ) {
    return this.svc.deletePhaseFromModule(user.companyId, moduleId, phaseId);
  }

  @Patch('modules/:moduleId/phases/reorder')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Reordenar fases de módulo' })
  reorderPhasesInModule(@GetUser() user: JwtUser, @Param('moduleId') moduleId: string, @Body() dto: ReorderDto) {
    return this.svc.reorderPhasesInModule(user.companyId, moduleId, dto);
  }

  @Post('modules/:moduleId/phases/:phaseId/activities')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Agregar actividad a fase de módulo' })
  addActivityToModulePhase(
    @GetUser() user: JwtUser,
    @Param('moduleId') moduleId: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: CreateTemplateActivityDto,
  ) {
    return this.svc.addActivityToModulePhase(user.companyId, moduleId, phaseId, dto);
  }

  @Put('modules/:moduleId/activities/:activityId')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Actualizar actividad de módulo' })
  updateActivityInModule(
    @GetUser() user: JwtUser,
    @Param('moduleId') moduleId: string,
    @Param('activityId') activityId: string,
    @Body() dto: UpdateTemplateActivityDto,
  ) {
    return this.svc.updateActivityInModule(user.companyId, moduleId, activityId, dto);
  }

  @Delete('modules/:moduleId/activities/:activityId')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Eliminar actividad de módulo' })
  deleteActivityFromModule(
    @GetUser() user: JwtUser,
    @Param('moduleId') moduleId: string,
    @Param('activityId') activityId: string,
  ) {
    return this.svc.deleteActivityFromModule(user.companyId, moduleId, activityId);
  }

  @Patch('modules/:moduleId/phases/:phaseId/activities/reorder')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Reordenar actividades de una fase' })
  reorderActivitiesInModule(
    @GetUser() user: JwtUser,
    @Param('moduleId') moduleId: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.svc.reorderActivitiesInModule(user.companyId, moduleId, phaseId, dto);
  }

  // ── Modules per template ──────────────────────────────────────────────────

  @Post(':id/modules')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Agregar módulo a la plantilla' })
  addModule(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: CreateTemplateModuleDto) {
    return this.svc.addModule(user.companyId, id, dto);
  }

  @Put(':id/modules/:moduleId')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Actualizar módulo' })
  updateModule(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Body() dto: UpdateTemplateModuleDto,
  ) {
    return this.svc.updateModule(user.companyId, id, moduleId, dto);
  }

  @Delete(':id/modules/:moduleId')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Eliminar módulo (cascade)' })
  deleteModule(@GetUser() user: JwtUser, @Param('id') id: string, @Param('moduleId') moduleId: string) {
    return this.svc.deleteModule(user.companyId, id, moduleId);
  }

  @Patch(':id/modules/reorder')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Reordenar módulos' })
  reorderModules(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: ReorderDto) {
    return this.svc.reorderModules(user.companyId, id, dto);
  }

  // ── Phases ────────────────────────────────────────────────────────────────

  @Post(':id/modules/:moduleId/phases')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Agregar fase a un módulo' })
  addPhase(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Body() dto: CreateTemplatePhaseDto,
  ) {
    return this.svc.addPhase(user.companyId, id, moduleId, dto);
  }

  @Put(':id/phases/:phaseId')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Actualizar fase' })
  updatePhase(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: UpdateTemplatePhaseDto,
  ) {
    return this.svc.updatePhase(user.companyId, id, phaseId, dto);
  }

  @Delete(':id/modules/:moduleId/phases/:phaseId')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Eliminar fase' })
  deletePhase(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Param('phaseId') phaseId: string,
  ) {
    return this.svc.deletePhase(user.companyId, id, moduleId, phaseId);
  }

  @Patch(':id/modules/:moduleId/phases/reorder')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Reordenar fases' })
  reorderPhases(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.svc.reorderPhases(user.companyId, id, moduleId, dto);
  }

  // ── Activities ────────────────────────────────────────────────────────────

  @Post(':id/phases/:phaseId/activities')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Agregar actividad a una fase' })
  addActivity(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: CreateTemplateActivityDto,
  ) {
    return this.svc.addActivity(user.companyId, id, phaseId, dto);
  }

  @Delete(':id/activities/:activityId')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Eliminar actividad' })
  deleteActivity(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Param('activityId') activityId: string,
  ) {
    return this.svc.deleteActivity(user.companyId, id, activityId);
  }

  @Patch(':id/phases/:phaseId/activities/reorder')
  @Roles(...EDIT_ROLES)
  @ApiOperation({ summary: 'Reordenar actividades' })
  reorderActivities(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.svc.reorderActivities(user.companyId, id, phaseId, dto);
  }

  // ── Activity Threads ──────────────────────────────────────────────────────

  @Get('activities/:activityId/threads')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Hilos de una actividad de proyecto' })
  getThreads(@Param('activityId') activityId: string) {
    return this.svc.getActivityThreads(activityId);
  }

  @Post('activities/:activityId/threads')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Agregar novedad/comentario a actividad' })
  addThread(
    @GetUser() user: JwtUser,
    @Param('activityId') activityId: string,
    @Body() dto: CreateActivityThreadDto,
  ) {
    return this.svc.addActivityThread(activityId, user.id, user.userType === 'client' ? 'client' : 'agent', dto);
  }

  @Delete('activities/threads/:threadId')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Eliminar hilo propio' })
  deleteThread(@GetUser() user: JwtUser, @Param('threadId') threadId: string) {
    return this.svc.deleteActivityThread(threadId, user.id);
  }
}
