import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { MunicipiosService } from './municipios.service';
import { CreateMunicipioDto, UpdateMunicipioDto, MunicipioFilterDto } from './dto/municipio.dto';

@ApiTags('Municipios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('municipios')
export class MunicipiosController {
  constructor(private readonly svc: MunicipiosService) {}

  @Get()
  @Roles('admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support', 'support')
  @ApiOperation({ summary: 'Listar municipios paginados' })
  findAll(@GetUser() user: JwtUser, @Query() dto: MunicipioFilterDto) {
    return this.svc.findAll(user.companyId, dto);
  }

  @Get('list')
  @Roles('admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support', 'support')
  @ApiOperation({ summary: 'Lista completa sin paginar (para selectores)' })
  findAllList(@GetUser() user: JwtUser) {
    return this.svc.findAllList(user.companyId);
  }

  @Post()
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Crear municipio' })
  create(@GetUser() user: JwtUser, @Body() dto: CreateMunicipioDto) {
    return this.svc.create(user.companyId, dto);
  }

  @Post('bulk')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Carga masiva de municipios' })
  bulkCreate(@GetUser() user: JwtUser, @Body() body: { items: CreateMunicipioDto[] }) {
    return this.svc.bulkCreate(user.companyId, body.items);
  }

  @Put(':id')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Actualizar municipio' })
  update(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateMunicipioDto) {
    return this.svc.update(user.companyId, id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Eliminar municipio' })
  delete(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.delete(user.companyId, id);
  }
}
