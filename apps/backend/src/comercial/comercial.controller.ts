import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ComercialService } from './comercial.service';
import { CreateCotizacionDto, UpdateCotizacionDto, CotizacionFilterDto } from './dto/comercial.dto';

@UseGuards(JwtAuthGuard)
@Controller('comercial/cotizaciones')
export class ComercialController {
  constructor(private svc: ComercialService) {}

  @Get()
  findAll(@Request() req, @Query() q: CotizacionFilterDto) {
    return this.svc.findAll(req.user.companyId, q);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.svc.findOne(req.user.companyId, id);
  }

  @Post()
  create(@Request() req, @Body() dto: CreateCotizacionDto) {
    return this.svc.create(req.user.companyId, req.user.sub, dto);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateCotizacionDto) {
    return this.svc.update(req.user.companyId, id, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.svc.remove(req.user.companyId, id);
  }
}
