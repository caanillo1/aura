import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { ServiceOrdersService } from './service-orders.service';
import { InformeSchedulerService } from './informe-scheduler.service';
import {
  CreateServiceOrderDto, UpdateServiceOrderDto,
  ChangeStatusDto, AddImplementerDto, AddNoteDto, ServiceOrderFilterDto,
} from './dto/service-order.dto';

const ALL_ROLES = ['admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support'] as const;

@ApiTags('Service Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(
    private readonly svc: ServiceOrdersService,
    private readonly scheduler: InformeSchedulerService,
  ) {}

  @Get('by-client')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Listar OS de un cliente para asociación (sin permiso especial)' })
  listByClient(
    @GetUser() user: JwtUser,
    @Query('clientId') clientId: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findAll(user.companyId, { clientId, limit: limit ? Number(limit) : 200 } as any);
  }

  @Get()
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Listar órdenes de servicio' })
  findAll(@GetUser() user: JwtUser, @Query() dto: ServiceOrderFilterDto) {
    return this.svc.findAll(user.companyId, dto);
  }

  @Get(':id/executive-report')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Informe ejecutivo de la orden de servicio' })
  executiveReport(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.getExecutiveReport(user.companyId, id);
  }

  @Get(':id/full-report')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Informe ejecutivo completo con actas detalladas' })
  fullReport(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.getFullReport(user.companyId, id);
  }

  @Get(':id/alerts')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Análisis de alertas e indicadores predictivos de la OS' })
  getAlerts(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.getAlerts(user.companyId, id);
  }

  @Post(':id/download-analysis-pdf')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Descargar PDF del análisis de implementación (estilo ejecutivo)' })
  async downloadAnalysisPdf(
    @Res() res: any,
    @GetUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    const buffer = await this.svc.generateAnalysisPdfBuffer(user.companyId, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Analisis_${id}.pdf"`);
    res.end(buffer);
  }

  @Post(':id/send-analysis')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Enviar análisis de implementación por correo' })
  sendAnalysis(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { destinatarios: string[]; asunto?: string },
  ) {
    return this.svc.sendAnalysis(user.companyId, id, body);
  }

  @Get(':id/analysis-schedule')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Obtener config de automatización del análisis' })
  getAnalysisSchedule(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.scheduler.getAnalysisConfig(user.companyId, id);
  }

  @Post(':id/analysis-schedule')
  @Roles(...ALL_ROLES)
  @Permissions('orders.editar')
  @ApiOperation({ summary: 'Guardar config de automatización del análisis' })
  saveAnalysisSchedule(@GetUser() user: JwtUser, @Param('id') id: string, @Body() body: any) {
    return this.scheduler.saveAnalysisConfig(user.companyId, id, body);
  }

  @Post(':id/analysis-schedule/run-now')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Ejecutar envío de análisis ahora' })
  runAnalysisNow(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.scheduler.runAnalysisNow(user.companyId, id);
  }

  @Post(':id/send-report')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Enviar informe ejecutivo por correo' })
  sendReport(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { destinatarios: string[]; asunto?: string },
  ) {
    return this.svc.sendReport(user.companyId, id, body);
  }

  @Post(':id/send-pdf')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Enviar PDF generado en frontend como adjunto de correo' })
  sendPdf(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { destinatarios: string[]; asunto?: string; pdfBase64: string; filename?: string },
  ) {
    return this.svc.sendPdfAttachment(user.companyId, id, body);
  }

  @Post(':id/send-report-pdf')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Generar y enviar PDF del informe (ejecutivo o con actas) por correo' })
  sendReportPdf(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { destinatarios: string[]; asunto?: string; reportType: 'ejecutivo' | 'completo' },
  ) {
    return this.svc.sendReportPdf(user.companyId, id, body);
  }

  @Post(':id/download-report-pdf')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Descargar PDF del informe generado con Puppeteer (texto seleccionable)' })
  async downloadReportPdf(
    @Res() res: any,
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { reportType?: 'ejecutivo' | 'completo' },
  ) {
    const buffer = await this.svc.generateReportPdfBuffer(user.companyId, id, body.reportType ?? 'completo');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Informe_Ejecutivo_${id}.pdf"`);
    res.end(buffer);
  }

  @Get(':id/informe-schedule/weekly')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Obtener config de automatización semanal' })
  getWeeklySchedule(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.scheduler.getWeeklyConfig(user.companyId, id);
  }

  @Post(':id/informe-schedule/weekly')
  @Roles(...ALL_ROLES)
  @Permissions('orders.editar')
  @ApiOperation({ summary: 'Guardar config de automatización semanal' })
  saveWeeklySchedule(@GetUser() user: JwtUser, @Param('id') id: string, @Body() body: any) {
    return this.scheduler.saveWeeklyConfig(user.companyId, id, body);
  }

  @Post(':id/informe-schedule/weekly/run-now')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Ejecutar envío semanal ahora' })
  runWeeklyNow(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.scheduler.runWeeklyNow(user.companyId, id);
  }

  @Get(':id/informe-schedule/bimensual')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Obtener config de automatización bimensual' })
  getBimensualSchedule(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.scheduler.getBimensualConfig(user.companyId, id);
  }

  @Post(':id/informe-schedule/bimensual')
  @Roles(...ALL_ROLES)
  @Permissions('orders.editar')
  @ApiOperation({ summary: 'Guardar config de automatización bimensual' })
  saveBimensualSchedule(@GetUser() user: JwtUser, @Param('id') id: string, @Body() body: any) {
    return this.scheduler.saveBimensualConfig(user.companyId, id, body);
  }

  @Post(':id/informe-schedule/bimensual/run-now')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Ejecutar envío bimensual ahora (quincenal o mensual)' })
  runBimensualNow(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { period: 'quincenal' | 'mensual' },
  ) {
    return this.scheduler.runBimensualNow(user.companyId, id, body.period ?? 'quincenal');
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  @Permissions('orders.buscar')
  @ApiOperation({ summary: 'Detalle de orden de servicio' })
  findOne(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findOne(user.companyId, id);
  }

  @Post()
  @Roles(...ALL_ROLES)
  @Permissions('orders.nuevo')
  @ApiOperation({ summary: 'Crear orden de servicio' })
  create(@GetUser() user: JwtUser, @Body() dto: CreateServiceOrderDto) {
    return this.svc.create(user.companyId, user.id, dto);
  }

  @Put(':id')
  @Roles(...ALL_ROLES)
  @Permissions('orders.editar')
  @ApiOperation({ summary: 'Actualizar orden de servicio' })
  update(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateServiceOrderDto) {
    return this.svc.update(user.companyId, id, dto);
  }

  @Patch(':id/status')
  @Roles(...ALL_ROLES)
  @Permissions('orders.editar')
  @ApiOperation({ summary: 'Cambiar estado de la OS' })
  changeStatus(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: ChangeStatusDto) {
    return this.svc.changeStatus(user.companyId, id, user.id, dto);
  }

  @Post(':id/notes')
  @Roles(...ALL_ROLES)
  @Permissions('orders.editar')
  @ApiOperation({ summary: 'Agregar nota al historial de la OS' })
  addNote(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: AddNoteDto) {
    return this.svc.addNote(user.companyId, id, user.id, dto);
  }

  @Post(':id/notes/notify')
  @Roles(...ALL_ROLES)
  @Permissions('orders.editar')
  @ApiOperation({ summary: 'Enviar notificación de nota por correo a destinatarios configurados' })
  notifyNote(@GetUser() user: JwtUser, @Param('id') id: string, @Body() body: any) {
    return this.svc.notifyNote(user.companyId, id, user.id, body);
  }

  @Post(':id/implementers')
  @Roles(...ALL_ROLES)
  @Permissions('orders.asignar')
  @ApiOperation({ summary: 'Asignar implementador a la OS' })
  addImplementer(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: AddImplementerDto) {
    return this.svc.addImplementer(user.companyId, id, dto);
  }

  @Delete(':id/implementers/:userId')
  @Roles(...ALL_ROLES)
  @Permissions('orders.asignar')
  @ApiOperation({ summary: 'Remover implementador de la OS' })
  removeImplementer(@GetUser() user: JwtUser, @Param('id') id: string, @Param('userId') userId: string) {
    return this.svc.removeImplementer(user.companyId, id, userId);
  }

  @Delete(':id/history/:historyId')
  @Roles(...ALL_ROLES)
  @Permissions('orders.editar')
  @ApiOperation({ summary: 'Eliminar entrada del historial (nota o cambio de estado)' })
  deleteHistory(@GetUser() user: JwtUser, @Param('id') id: string, @Param('historyId') historyId: string) {
    return this.svc.deleteHistoryEntry(user.companyId, id, historyId);
  }

  @Post('bulk-delete')
  @Roles(...ALL_ROLES)
  @Permissions('orders.eliminar')
  @ApiOperation({ summary: 'Eliminar múltiples órdenes de servicio' })
  bulkDelete(@GetUser() user: JwtUser, @Body() body: { ids: string[] }) {
    return this.svc.bulkDelete(user.companyId, body.ids);
  }

  @Delete(':id')
  @Roles(...ALL_ROLES)
  @Permissions('orders.eliminar')
  @ApiOperation({ summary: 'Eliminar orden de servicio' })
  delete(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.delete(user.companyId, id);
  }
}
