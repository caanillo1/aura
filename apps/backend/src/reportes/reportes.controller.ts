import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportesService } from './reportes.service';
import {
  ReporteOrdenesDto, ReporteProyectosDto,
  ReporteCapacitacionesDto, ReporteRequerimientosDto,
} from './dto/reporte.dto';

@ApiTags('Reportes')
@UseGuards(JwtAuthGuard)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly svc: ReportesService) {}

  @Get('ordenes')
  ordenes(@Req() req: any, @Query() dto: ReporteOrdenesDto) {
    return this.svc.reporteOrdenes(req.user.companyId, dto);
  }

  @Get('proyectos')
  proyectos(@Req() req: any, @Query() dto: ReporteProyectosDto) {
    return this.svc.reporteProyectos(req.user.companyId, dto);
  }

  @Get('capacitaciones')
  capacitaciones(@Req() req: any, @Query() dto: ReporteCapacitacionesDto) {
    return this.svc.reporteCapacitaciones(req.user.companyId, dto);
  }

  @Get('requerimientos')
  requerimientos(@Req() req: any, @Query() dto: ReporteRequerimientosDto) {
    return this.svc.reporteRequerimientos(req.user.companyId, dto);
  }
}
