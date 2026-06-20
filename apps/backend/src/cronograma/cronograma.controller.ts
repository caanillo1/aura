import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CronogramaService } from './cronograma.service';
import { CreateBloqueDto, UpdateBloqueDto, BloqueFilterDto } from './dto/cronograma.dto';

@UseGuards(JwtAuthGuard)
@Controller('cronograma')
export class CronogramaController {
  constructor(private svc: CronogramaService) {}

  @Get()
  findAll(@Request() req, @Query() q: BloqueFilterDto) {
    return this.svc.findAll(req.user.companyId, q);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.svc.findOne(req.user.companyId, id);
  }

  @Post()
  create(@Request() req, @Body() dto: CreateBloqueDto) {
    return this.svc.create(req.user.companyId, req.user.id, dto);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateBloqueDto) {
    return this.svc.update(req.user.companyId, id, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.svc.remove(req.user.companyId, id);
  }
}
