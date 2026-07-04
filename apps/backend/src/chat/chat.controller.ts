import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { ChatService } from './chat.service';
import type { ChatMessage, ChatContext } from './chat.service';

class MessageDto implements ChatMessage {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  content: string;
}

class ContextDto implements ChatContext {
  @ApiPropertyOptional() @IsOptional() @IsString() pagina?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entityTipo?: string;
}

class ChatRequestDto {
  @ApiProperty()
  @IsString()
  mensaje: string;

  @ApiProperty({ type: [MessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  historial: MessageDto[];

  @ApiPropertyOptional({ type: ContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContextDto)
  contexto?: ContextDto;
}

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly svc: ChatService) {}

  @Post('message')
  send(@GetUser() user: JwtUser, @Body() body: ChatRequestDto) {
    return this.svc.chat(user.companyId, body.mensaje, body.historial, body.contexto);
  }
}
