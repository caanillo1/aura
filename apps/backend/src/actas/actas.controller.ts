import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { ActasService } from './actas.service';
import { CreateActaDto, UpdateActaDto } from './dto/acta.dto';

const IMPL_ROLES = ['admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support'] as const;

@ApiTags('Actas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('actas')
export class ActasController {
  constructor(private readonly svc: ActasService) {}

  @Get()
  @Roles(...IMPL_ROLES, 'client')
  @ApiOperation({ summary: 'Listar actas de un proyecto' })
  findAll(@GetUser() user: JwtUser, @Query('projectId') projectId: string) {
    return this.svc.findAll(user.companyId, projectId);
  }

  @Get(':id')
  @Roles(...IMPL_ROLES, 'client')
  @ApiOperation({ summary: 'Detalle de acta' })
  findOne(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findOne(user.companyId, id);
  }

  @Post()
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Crear acta' })
  create(@GetUser() user: JwtUser, @Body() dto: CreateActaDto) {
    return this.svc.create(user.companyId, user.id, dto);
  }

  @Patch(':id')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Actualizar acta' })
  update(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateActaDto) {
    return this.svc.update(user.companyId, id, dto);
  }

  @Patch('firmantes/:id/sign')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Firmar digitalmente (agente autenticado)' })
  signFirmante(@Param('id') id: string, @Body() body: { signatureData: string }) {
    return this.svc.signFirmante(id, body.signatureData, 'agent');
  }

  @Patch('compromisos/:id')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Actualizar estado de un compromiso' })
  updateCompromiso(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { estado: string },
  ) {
    return this.svc.updateCompromiso(user.companyId, id, body);
  }

  @Patch(':id/finalizar')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Marcar acta como finalizada' })
  finalizeActa(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.finalizeActa(user.companyId, id);
  }

  @Post(':id/resend-email')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Reenviar correo de firma a firmante(s)' })
  resendEmail(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { firmanteId?: string },
  ) {
    return this.svc.resendFirmanteEmail(user.companyId, id, body.firmanteId);
  }

  @Delete(':id')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Eliminar acta' })
  remove(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.remove(user.companyId, id);
  }
}
