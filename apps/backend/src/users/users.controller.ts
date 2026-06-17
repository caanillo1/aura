import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, ResetPasswordDto } from './dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get('me')
  @Roles('admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support', 'client')
  @ApiOperation({ summary: 'Obtener mi perfil con firma digital' })
  getMe(@GetUser() user: JwtUser) {
    return this.svc.getMe(user.id);
  }

  @Patch('me/signature')
  @Roles('admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support')
  @ApiOperation({ summary: 'Guardar mi firma digital' })
  updateMySignature(@GetUser() user: JwtUser, @Body() body: { signatureData: string | null }) {
    return this.svc.updateMySignature(user.id, body.signatureData);
  }

  @Get('agents')
  @Roles('admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support')
  @ApiOperation({ summary: 'Listar agentes para asignación (sin permisos especiales)' })
  listAgents(@GetUser() user: JwtUser, @Query() pagination: PaginationDto) {
    return this.svc.findAll(user.companyId, { ...pagination, userType: 'agent' });
  }

  @Get()
  @Roles('admin', 'coordinator')
  @Permissions('users.buscar')
  @ApiOperation({ summary: 'Listar usuarios con paginación y filtros' })
  @ApiQuery({ name: 'userType', required: false, enum: ['agent', 'client'] })
  @ApiQuery({ name: 'roleSlug', required: false })
  findAll(
    @GetUser() user: JwtUser,
    @Query() pagination: PaginationDto,
    @Query('userType') userType?: string,
    @Query('roleSlug') roleSlug?: string,
  ) {
    return this.svc.findAll(user.companyId, { ...pagination, userType, roleSlug });
  }

  @Get(':id')
  @Roles('admin', 'coordinator')
  @Permissions('users.buscar')
  @ApiOperation({ summary: 'Obtener detalle de un usuario' })
  findOne(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findOne(user.companyId, id);
  }

  @Post()
  @Roles('admin')
  @Permissions('users.nuevo')
  @ApiOperation({ summary: 'Crear usuario (admin)' })
  create(@GetUser() user: JwtUser, @Body() dto: CreateUserDto) {
    return this.svc.create(user.companyId, dto);
  }

  @Put(':id')
  @Roles('admin', 'coordinator')
  @Permissions('users.editar')
  @ApiOperation({ summary: 'Actualizar usuario' })
  update(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.svc.update(user.companyId, id, dto);
  }

  @Patch(':id/status')
  @Roles('admin')
  @Permissions('users.desactivar')
  @ApiOperation({ summary: 'Activar / desactivar usuario' })
  toggleStatus(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.toggleStatus(user.companyId, id);
  }

  @Patch(':id/password')
  @Roles('admin')
  @Permissions('users.password')
  @ApiOperation({ summary: 'Resetear contraseña de un usuario (admin)' })
  resetPassword(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.svc.resetPassword(user.companyId, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @Permissions('users.eliminar')
  @ApiOperation({ summary: 'Eliminar usuario (admin)' })
  delete(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.delete(user.companyId, id, user.id);
  }
}
