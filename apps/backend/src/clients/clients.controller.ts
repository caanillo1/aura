import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ClientsService } from './clients.service';
import {
  CreateClientDto, UpdateClientDto, CreateStaffDto, UpdateStaffDto, BulkCreateStaffDto,
} from './dto/client.dto';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly svc: ClientsService) {}

  @Get()
  @Roles('admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support', 'support')
  @ApiOperation({ summary: 'Listar clientes con paginación' })
  findAll(@GetUser() user: JwtUser, @Query() dto: PaginationDto) {
    return this.svc.findAll(user.companyId, dto);
  }

  @Get(':id')
  @Roles('admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support', 'support')
  @ApiOperation({ summary: 'Detalle de cliente con personal' })
  findOne(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findOne(user.companyId, id);
  }

  @Post()
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Crear cliente' })
  create(@GetUser() user: JwtUser, @Body() dto: CreateClientDto) {
    return this.svc.create(user.companyId, user.id, dto);
  }

  @Put(':id')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Actualizar cliente' })
  update(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.svc.update(user.companyId, id, dto);
  }

  @Patch(':id/status')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Activar / desactivar cliente' })
  toggleStatus(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.toggleStatus(user.companyId, id);
  }

  // ── Usuarios del cliente ─────────────────────────────────────────────────
  @Get(':id/users')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Listar usuarios (portal) del cliente' })
  findUsers(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findUsers(user.companyId, id);
  }

  // ── Personal del cliente ──────────────────────────────────────────────────
  @Get(':id/staff')
  @Roles('admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support')
  @ApiOperation({ summary: 'Listar funcionarios del cliente' })
  findStaff(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findStaff(user.companyId, id);
  }

  @Post(':id/staff')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Agregar funcionario al cliente' })
  createStaff(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: CreateStaffDto) {
    return this.svc.createStaff(user.companyId, id, dto);
  }

  @Put(':id/staff/:staffId')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Actualizar funcionario' })
  updateStaff(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.svc.updateStaff(user.companyId, id, staffId, dto);
  }

  @Delete(':id/staff/:staffId')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Eliminar funcionario' })
  deleteStaff(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Param('staffId') staffId: string,
  ) {
    return this.svc.deleteStaff(user.companyId, id, staffId);
  }

  @Post(':id/staff/bulk')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Carga masiva de funcionarios desde Excel' })
  bulkCreateStaff(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: BulkCreateStaffDto) {
    return this.svc.bulkCreateStaff(user.companyId, id, dto);
  }
}
