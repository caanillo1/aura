import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SesionesService } from './sesiones.service';
import { CreateSesionDto, UpdateSesionDto, InvitadoDto } from './dto/sesion.dto';

@ApiTags('sesiones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sesiones')
export class SesionesController {
  constructor(private sesionesService: SesionesService) {}

  @Post()
  create(@Body() dto: CreateSesionDto, @Request() req: any) {
    return this.sesionesService.create(dto, req.user.id);
  }

  @Get()
  findAll(@Query('projectId') projectId: string) {
    return this.sesionesService.findAll(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sesionesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSesionDto) {
    return this.sesionesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sesionesService.remove(id);
  }

  @Post(':id/invitados')
  addInvitado(@Param('id') id: string, @Body() dto: InvitadoDto) {
    return this.sesionesService.addInvitado(id, dto);
  }

  @Delete(':id/invitados/:invitadoId')
  removeInvitado(@Param('invitadoId') invitadoId: string) {
    return this.sesionesService.removeInvitado(invitadoId);
  }

  @Post(':id/generar-acta')
  generarActa(@Param('id') id: string, @Request() req: any) {
    return this.sesionesService.generarActa(id, req.user.id);
  }
}
