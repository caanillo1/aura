import { Controller, Get, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificaciones del usuario autenticado' })
  findAll(@GetUser() user: JwtUser, @Query('limit') limit?: string) {
    return this.svc.findAll(user.id, limit ? +limit : 30);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  markAllRead(@GetUser() user: JwtUser) {
    return this.svc.markAllRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  markRead(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.markRead(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una notificación' })
  remove(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.remove(user.id, id);
  }
}
