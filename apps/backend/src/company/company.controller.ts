import { IsArray, IsString } from 'class-validator'
import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('Company')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('company')
export class CompanyController {
  constructor(private readonly svc: CompanyService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener información de la empresa' })
  findOne(@GetUser() user: JwtUser) {
    return this.svc.findOne(user.companyId);
  }

  @Put()
  @Roles('admin')
  @Permissions('settings.editar')
  @ApiOperation({ summary: 'Actualizar datos de la empresa (admin)' })
  update(@GetUser() user: JwtUser, @Body() dto: UpdateCompanyDto) {
    return this.svc.update(user.companyId, dto);
  }

  @Get('roles')
  @ApiOperation({ summary: 'Listar roles del sistema' })
  getRoles(@GetUser() user: JwtUser) {
    return this.svc.getRoles(user.companyId);
  }

  @Get('stats')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Estadísticas generales del sistema' })
  getStats(@GetUser() user: JwtUser) {
    return this.svc.getStats(user.companyId);
  }

  @Get('dashboard/ai-insight')
  @ApiOperation({ summary: 'Briefing ejecutivo generado por IA basado en el dashboard' })
  getAiInsight(
    @GetUser() user: JwtUser,
    @Query('clientId') clientId?: string,
    @Query('agentId') agentId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.getAiInsight(user.companyId, {
      clientId: clientId || undefined,
      agentId: agentId || undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Datos completos del dashboard ejecutivo' })
  getDashboard(
    @GetUser() user: JwtUser,
    @Query('clientId') clientId?: string,
    @Query('agentId') agentId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.getDashboard(user.companyId, {
      clientId: clientId || undefined,
      agentId: agentId || undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });
  }

  @Get('configs')
  @Roles('admin')
  @ApiOperation({ summary: 'Obtener configuraciones del sistema' })
  getConfigs(@GetUser() user: JwtUser) {
    return this.svc.getConfigs(user.companyId);
  }

  @Post('roles')
  @Roles('admin')
  @Permissions('roles.manage')
  @ApiOperation({ summary: 'Crear un nuevo rol' })
  createRole(
    @GetUser() user: JwtUser,
    @Body('name') name: string,
    @Body('description') description?: string,
  ) {
    return this.svc.createRole(user.companyId, name, description);
  }

  @Delete('roles/:roleId')
  @Roles('admin')
  @Permissions('roles.manage')
  @ApiOperation({ summary: 'Eliminar un rol personalizado' })
  deleteRole(@GetUser() user: JwtUser, @Param('roleId') roleId: string) {
    return this.svc.deleteRole(user.companyId, roleId);
  }

  @Patch('roles/:roleId/permissions')
  @Roles('admin')
  @Permissions('roles.manage')
  @ApiOperation({ summary: 'Actualizar permisos de un rol' })
  updateRolePermissions(
    @GetUser() user: JwtUser,
    @Param('roleId') roleId: string,
    @Body('permissions') permissions: string[],
  ) {
    return this.svc.updateRolePermissions(user.companyId, roleId, permissions);
  }

  @Patch('configs/:key')
  @Roles('admin')
  @Permissions('settings.editar')
  @ApiOperation({ summary: 'Actualizar una configuración del sistema' })
  upsertConfig(
    @GetUser() user: JwtUser,
    @Param('key') key: string,
    @Body('value') value: string,
  ) {
    return this.svc.upsertConfig(user.companyId, key, value);
  }
}

