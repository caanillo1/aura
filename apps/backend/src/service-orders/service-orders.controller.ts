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
import { ServiceOrdersService } from './service-orders.service';
import {
  CreateServiceOrderDto, UpdateServiceOrderDto,
  ChangeStatusDto, AddImplementerDto, ServiceOrderFilterDto,
} from './dto/service-order.dto';

@ApiTags('Service Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly svc: ServiceOrdersService) {}

  @Get()
  @Roles('admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support')
  @ApiOperation({ summary: 'Listar órdenes de servicio' })
  findAll(@GetUser() user: JwtUser, @Query() dto: ServiceOrderFilterDto) {
    return this.svc.findAll(user.companyId, dto);
  }

  @Get(':id')
  @Roles('admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support')
  @ApiOperation({ summary: 'Detalle de orden de servicio' })
  findOne(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findOne(user.companyId, id);
  }

  @Post()
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Crear orden de servicio' })
  create(@GetUser() user: JwtUser, @Body() dto: CreateServiceOrderDto) {
    return this.svc.create(user.companyId, user.id, dto);
  }

  @Put(':id')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Actualizar orden de servicio' })
  update(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateServiceOrderDto) {
    return this.svc.update(user.companyId, id, dto);
  }

  @Patch(':id/status')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Cambiar estado de la OS' })
  changeStatus(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: ChangeStatusDto) {
    return this.svc.changeStatus(user.companyId, id, user.id, dto);
  }

  @Post(':id/implementers')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Asignar implementador a la OS' })
  addImplementer(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: AddImplementerDto) {
    return this.svc.addImplementer(user.companyId, id, dto);
  }

  @Delete(':id/implementers/:userId')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Remover implementador de la OS' })
  removeImplementer(@GetUser() user: JwtUser, @Param('id') id: string, @Param('userId') userId: string) {
    return this.svc.removeImplementer(user.companyId, id, userId);
  }
}
