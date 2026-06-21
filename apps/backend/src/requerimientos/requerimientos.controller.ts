import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { RequerimientosService } from './requerimientos.service';
import { EmailSchedulerService } from './email-scheduler.service';
import type { EmailScheduleConfig } from './email-scheduler.service';
import { CreateRequerimientoDto, AddGestionDto, RequerimientoFilterDto, EnviarCorreoRequerimientosDto, CreateBulkRequerimientosDto, BulkGestionDto, UpdateRequerimientoDto } from './dto/requerimiento.dto';

const ALL_ROLES  = ['admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support'] as const;
const ADMIN_COORD = ['admin', 'coordinator'] as const;

@ApiTags('Requerimientos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requerimientos')
export class RequerimientosController {
  constructor(
    private readonly svc: RequerimientosService,
    private readonly scheduler: EmailSchedulerService,
  ) {}

  @Get()
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Listar requerimientos' })
  findAll(@GetUser() user: JwtUser, @Query() dto: RequerimientoFilterDto) {
    return this.svc.findAll(user.companyId, dto);
  }

  @Get('analytics')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Analítica completa de requerimientos' })
  getAnalytics(
    @GetUser() user: JwtUser,
    @Query('clientId')  clientId?: string,
    @Query('agenteId')  agenteId?: string,
    @Query('area')      area?: string,
    @Query('tipo')      tipo?: string,
    @Query('dateFrom')  dateFrom?: string,
    @Query('dateTo')    dateTo?: string,
  ) {
    return this.svc.getAnalytics(user.companyId, { clientId, agenteId, area, tipo, dateFrom, dateTo });
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Detalle de requerimiento' })
  findOne(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findOne(user.companyId, id);
  }

  @Post()
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Crear requerimiento' })
  create(@GetUser() user: JwtUser, @Body() dto: CreateRequerimientoDto) {
    return this.svc.create(user.companyId, user.id, dto);
  }

  @Patch(':id')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Actualizar campos de un requerimiento' })
  update(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateRequerimientoDto) {
    return this.svc.updateRequerimiento(user.companyId, id, dto);
  }

  @Post(':id/gestiones')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Registrar gestión de requerimiento' })
  addGestion(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: AddGestionDto) {
    return this.svc.addGestion(user.companyId, id, user.id, dto);
  }

  @Delete(':id')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Eliminar requerimiento' })
  delete(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.deleteRequerimiento(user.companyId, id);
  }

  @Post('bulk-gestion')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Aplicar la misma gestión a varios requerimientos' })
  bulkGestion(@GetUser() user: JwtUser, @Body() dto: BulkGestionDto) {
    return this.svc.bulkGestion(user.companyId, user.id, dto);
  }

  @Post('bulk-gestion-individual')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Aplicar gestiones individuales (desde Excel)' })
  bulkGestionIndividual(
    @GetUser() user: JwtUser,
    @Body() body: { rows: { id: string; fecha: string; estado: string; observacion: string }[] },
  ) {
    return this.svc.bulkGestionIndividual(user.companyId, user.id, body.rows);
  }

  @Post('bulk')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Cargue masivo de requerimientos' })
  createBulk(@GetUser() user: JwtUser, @Body() dto: CreateBulkRequerimientosDto) {
    return this.svc.createBulk(user.companyId, user.id, dto);
  }

  @Post('correo')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Enviar resumen de requerimientos por correo' })
  enviarCorreo(@GetUser() user: JwtUser, @Body() dto: EnviarCorreoRequerimientosDto) {
    return this.svc.enviarCorreo(user.companyId, dto);
  }

  @Get('schedule')
  @Roles(...ADMIN_COORD)
  @ApiOperation({ summary: 'Obtener configuración de envío automático' })
  getSchedule(@GetUser() user: JwtUser) {
    return this.scheduler.getSchedule(user.companyId);
  }

  @Post('schedule')
  @Roles(...ADMIN_COORD)
  @ApiOperation({ summary: 'Guardar configuración de envío automático' })
  saveSchedule(@GetUser() user: JwtUser, @Body() cfg: Record<string, any>) {
    return this.scheduler.saveSchedule(user.companyId, cfg as EmailScheduleConfig);
  }

  @Post('schedule/run-now')
  @Roles(...ADMIN_COORD)
  @ApiOperation({ summary: 'Ejecutar envío automático inmediatamente (prueba)' })
  runScheduleNow(@GetUser() user: JwtUser) {
    return this.scheduler.runNow(user.companyId);
  }
}
