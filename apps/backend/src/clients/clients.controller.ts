import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ClientsService } from './clients.service';
import {
  CreateClientDto, UpdateClientDto, CreateStaffDto, UpdateStaffDto, BulkCreateStaffDto, BulkCreateClientDto,
} from './dto/client.dto';

const ALL_ROLES   = ['admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support'] as const;
const READ_ROLES  = [...ALL_ROLES, 'support'] as const;

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly svc: ClientsService) {}

  @Get()
  @Roles(...READ_ROLES)
  @Permissions('clients.buscar')
  @ApiOperation({ summary: 'Listar clientes con paginación' })
  findAll(@GetUser() user: JwtUser, @Query() dto: PaginationDto) {
    return this.svc.findAll(user.companyId, dto);
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  @Permissions('clients.buscar')
  @ApiOperation({ summary: 'Detalle de cliente con personal' })
  findOne(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findOne(user.companyId, id);
  }

  @Post()
  @Roles(...ALL_ROLES)
  @Permissions('clients.nuevo')
  @ApiOperation({ summary: 'Crear cliente' })
  create(@GetUser() user: JwtUser, @Body() dto: CreateClientDto) {
    return this.svc.create(user.companyId, user.id, dto);
  }

  @Post('bulk')
  @Roles(...ALL_ROLES)
  @Permissions('clients.importar')
  @ApiOperation({ summary: 'Cargue masivo de clientes desde Excel' })
  bulkCreate(@GetUser() user: JwtUser, @Body() dto: BulkCreateClientDto) {
    return this.svc.bulkCreate(user.companyId, user.id, dto);
  }

  @Delete(':id')
  @Roles(...ALL_ROLES)
  @Permissions('clients.eliminar')
  @ApiOperation({ summary: 'Eliminar cliente' })
  delete(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.delete(user.companyId, id);
  }

  @Post('bulk-delete')
  @Roles(...ALL_ROLES)
  @Permissions('clients.eliminar')
  @ApiOperation({ summary: 'Eliminar varios clientes' })
  bulkDelete(@GetUser() user: JwtUser, @Body() body: { ids: string[] }) {
    return this.svc.bulkDelete(user.companyId, body.ids);
  }

  @Put(':id')
  @Roles(...ALL_ROLES)
  @Permissions('clients.editar')
  @ApiOperation({ summary: 'Actualizar cliente' })
  update(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.svc.update(user.companyId, id, dto);
  }

  @Patch(':id/status')
  @Roles(...ALL_ROLES)
  @Permissions('clients.editar')
  @ApiOperation({ summary: 'Activar / desactivar cliente' })
  toggleStatus(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.toggleStatus(user.companyId, id);
  }

  // ── Usuarios del cliente ─────────────────────────────────────────────────
  @Get(':id/users')
  @Roles(...ALL_ROLES)
  @Permissions('clients.buscar')
  @ApiOperation({ summary: 'Listar usuarios (portal) del cliente' })
  findUsers(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findUsers(user.companyId, id);
  }

  // ── Personal del cliente ──────────────────────────────────────────────────
  @Get(':id/staff')
  @Roles(...ALL_ROLES)
  @Permissions('clients.staff')
  @ApiOperation({ summary: 'Listar funcionarios del cliente' })
  findStaff(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findStaff(user.companyId, id);
  }

  @Post(':id/staff')
  @Roles(...ALL_ROLES)
  @Permissions('clients.staff')
  @ApiOperation({ summary: 'Agregar funcionario al cliente' })
  createStaff(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: CreateStaffDto) {
    return this.svc.createStaff(user.companyId, id, dto);
  }

  @Put(':id/staff/:staffId')
  @Roles(...ALL_ROLES)
  @Permissions('clients.staff')
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
  @Roles(...ALL_ROLES)
  @Permissions('clients.staff')
  @ApiOperation({ summary: 'Eliminar funcionario' })
  deleteStaff(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    @Param('staffId') staffId: string,
  ) {
    return this.svc.deleteStaff(user.companyId, id, staffId);
  }

  @Post(':id/staff/bulk')
  @Roles(...ALL_ROLES)
  @Permissions('clients.importar')
  @ApiOperation({ summary: 'Carga masiva de funcionarios desde Excel' })
  bulkCreateStaff(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: BulkCreateStaffDto) {
    return this.svc.bulkCreateStaff(user.companyId, id, dto);
  }
}
