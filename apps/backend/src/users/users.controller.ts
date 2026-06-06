import {
  Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, ResetPasswordDto } from './dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  @Roles('admin', 'coordinator')
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
  @ApiOperation({ summary: 'Obtener detalle de un usuario' })
  findOne(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findOne(user.companyId, id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Crear usuario (admin)' })
  create(@GetUser() user: JwtUser, @Body() dto: CreateUserDto) {
    return this.svc.create(user.companyId, dto);
  }

  @Put(':id')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Actualizar usuario' })
  update(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.svc.update(user.companyId, id, dto);
  }

  @Patch(':id/status')
  @Roles('admin')
  @ApiOperation({ summary: 'Activar / desactivar usuario' })
  toggleStatus(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.toggleStatus(user.companyId, id);
  }

  @Patch(':id/password')
  @Roles('admin')
  @ApiOperation({ summary: 'Resetear contraseña de un usuario (admin)' })
  resetPassword(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.svc.resetPassword(user.companyId, id, dto);
  }
}
