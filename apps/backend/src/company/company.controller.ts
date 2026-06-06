import { Controller, Get, Put, Patch, Body, Param, UseGuards, IsArray, IsString } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('Company')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Get('configs')
  @Roles('admin')
  @ApiOperation({ summary: 'Obtener configuraciones del sistema' })
  getConfigs(@GetUser() user: JwtUser) {
    return this.svc.getConfigs(user.companyId);
  }

  @Patch('roles/:roleId/permissions')
  @Roles('admin')
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
  @ApiOperation({ summary: 'Actualizar una configuración del sistema' })
  upsertConfig(
    @GetUser() user: JwtUser,
    @Param('key') key: string,
    @Body('value') value: string,
  ) {
    return this.svc.upsertConfig(user.companyId, key, value);
  }
}
