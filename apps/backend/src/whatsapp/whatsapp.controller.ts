import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly wa: WhatsAppService) {}

  @Get('status')
  @ApiOperation({ summary: 'Estado de la conexión de WhatsApp' })
  getStatus() {
    return this.wa.getStatus();
  }

  @Post('disconnect')
  @ApiOperation({ summary: 'Cerrar sesión de WhatsApp' })
  async disconnect() {
    await this.wa.disconnect();
    return { ok: true };
  }

  @Post('send-test')
  @ApiOperation({ summary: 'Enviar mensaje de prueba' })
  sendTest(@Body() body: { phone: string }) {
    return this.wa.sendTest(body.phone);
  }
}
