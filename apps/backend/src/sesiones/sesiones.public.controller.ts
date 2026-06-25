import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SesionesService } from './sesiones.service';
import { EntrarSalaDto } from './dto/sesion.dto';

@ApiTags('public-sesiones')
@Controller('public/sesiones')
export class SesionesPublicController {
  constructor(private sesionesService: SesionesService) {}

  // ── RSVP ─────────────────────────────────────────────────────────────────────

  @Get('rsvp/:token')
  getRsvp(@Param('token') token: string) {
    return this.sesionesService.getRsvp(token);
  }

  @Post('rsvp/:token/confirmar')
  confirmar(@Param('token') token: string) {
    return this.sesionesService.confirmarRsvp(token);
  }

  @Post('rsvp/:token/cancelar')
  cancelar(@Param('token') token: string) {
    return this.sesionesService.cancelarRsvp(token);
  }

  // ── Sala ──────────────────────────────────────────────────────────────────────

  @Get('sala/:token')
  getSala(@Param('token') token: string) {
    return this.sesionesService.getSala(token);
  }

  @Post('sala/:token/entrar')
  entrar(@Param('token') token: string, @Body() dto: EntrarSalaDto) {
    return this.sesionesService.entrarSala(token, dto);
  }
}
