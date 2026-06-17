import {
  IsString, IsNotEmpty, IsOptional, IsIn, IsUUID, IsEmail, IsArray, ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

const TIPOS = ['Funcional','No funcional','Mejora','Corrección','Integración','Otro'];
const PRIORIDADES = ['Crítico','Alta','Media','Baja'];
const AREAS = ['Asistencial','Financiero'];
const ESTADOS = ['Elaborado','Priorizado','Devuelto','Negado','Repriorizado','Entregado'];

export class CreateRequerimientoDto {
  @ApiProperty() @IsString() @IsNotEmpty() titulo: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(TIPOS) tipo?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(PRIORIDADES) prioridad?: string;
  @ApiProperty() @IsString() @IsNotEmpty() descripcion: string;
  @ApiPropertyOptional() @IsOptional() @IsString() criteriosAceptacion?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() templateModuleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() templatePhaseId?: string;
  @ApiProperty() @IsIn(AREAS) area: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ticketRubi?: string;
  @ApiProperty() @IsUUID() clientId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() serviceOrderId?: string;
  @ApiProperty() @IsUUID() agenteId: string;
}

export class AddGestionDto {
  @ApiProperty() @IsString() @IsNotEmpty() fecha: string;
  @ApiProperty() @IsIn(ESTADOS) estado: string;
  @ApiProperty() @IsString() @IsNotEmpty() observacion: string;
}

export class CreateBulkRequerimientosDto {
  @ApiProperty({ type: [CreateRequerimientoDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateRequerimientoDto)
  requerimientos: CreateRequerimientoDto[];
}

export class BulkGestionDto {
  @ApiProperty({ type: [String] })
  @IsArray() @ArrayNotEmpty() @IsUUID('all', { each: true })
  ids: string[];

  @ApiProperty() @IsString() @IsNotEmpty() fecha: string;
  @ApiProperty() @IsIn(ESTADOS) estado: string;
  @ApiProperty() @IsString() @IsNotEmpty() observacion: string;
}

export class EnviarCorreoRequerimientosDto {
  @ApiProperty({ type: [String] })
  @IsArray() @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  destinatarios: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() asunto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mensaje?: string;

  // Filtros — mismos que RequerimientoFilterDto
  @ApiPropertyOptional() @IsOptional() @IsString() clientId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agenteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() area?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() prioridad?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) estadosActual?: string[];
}

export class UpdateRequerimientoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() titulo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descripcion?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(TIPOS) tipo?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(PRIORIDADES) prioridad?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(AREAS) area?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ticketRubi?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() agenteId?: string;
  @ApiPropertyOptional() @IsOptional() serviceOrderId?: string | null;
  @ApiPropertyOptional() @IsOptional() templateModuleId?: string | null;
  @ApiPropertyOptional() @IsOptional() templatePhaseId?: string | null;
}

export class RequerimientoFilterDto {
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => Number(value)) page?: number;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => Number(value)) limit?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceOrderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agenteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() area?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() prioridad?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() estadoActual?: string;
}
