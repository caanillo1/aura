import {
  IsString, IsOptional, IsUUID, IsDateString, IsIn, IsArray,
  IsBoolean, IsNumber, ValidateNested, Min, IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AiDraftDto {
  @ApiProperty() @IsString() @IsIn(['inicio', 'visita', 'cierre', 'capacitacion', 'entrega_soporte']) type: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientName?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) modules?: string[];
}


import { Type } from 'class-transformer';

export class ActaFirmanteDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nombre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cargo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() empresa?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telefono?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() documento?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() fecha?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) orden?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() signatureData?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() signedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() signerType?: string;
}

export class ActaFechaVisitaDto {
  @ApiProperty() @IsDateString() fecha: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horaInicio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horaFin?: string;
}

export class ActaCompromisoDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) numero?: number;
  @ApiProperty() @IsString() compromiso: string;
  @ApiPropertyOptional() @IsOptional() @IsString() responsable?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() estado?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assignedToId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientStaffId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() moduleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() phaseId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() activityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() fechaLimite?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['agente','cliente']) responsablePrincipal?: string;
}

export class ActaParticipanteDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) numero?: number;
  @ApiProperty() @IsString() nombre: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cargo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() documento?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horaEntrada?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horaSalida?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() comprendio?: boolean;
}

export class ActaAccionDto {
  @ApiProperty() @IsString() accion: string;
  @ApiPropertyOptional() @IsOptional() @IsString() responsable?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() fechaLimite?: string;
}

export class ActaContactoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() nombre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telefono?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() area?: string;
}

export class ActaActividadDto {
  @ApiProperty() @IsUUID() activityId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assignedToId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientStaffId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

export class CreateActaDto {
  @ApiProperty() @IsUUID() projectId: string;
  @ApiProperty() @IsString() @IsIn(['inicio','visita','cierre','capacitacion','entrega_soporte']) type: string;
  @ApiPropertyOptional() @IsOptional() @IsString() numero?: string;
  @ApiProperty() @IsDateString() fecha: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ciudad?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() municipioId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lugar?: string;

  // inicio
  @ApiPropertyOptional() @IsOptional() @IsString() asunto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() objetivoGeneral?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() alcance?: string;

  // visita
  @ApiPropertyOptional() @IsOptional() @IsString() implementadorNombre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() jefeNombre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() actividadesRealizadas?: string;

  // cierre
  @ApiPropertyOptional() @IsOptional() @IsString() cuerpo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cierreModulosJson?: string;

  // capacitacion
  @ApiPropertyOptional() @IsOptional() @IsUUID() moduloId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() expositor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() temasCapacitacion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horaInicio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horaFin?: string;

  // entrega_soporte
  @ApiPropertyOptional() @IsOptional() @IsString() nitCliente?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sedes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() responsableImplementador?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() responsableSoporte?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() capacitacionModalidad?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) capacitacionHoras?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() capacitacionPruebas?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() requerimientosAdicionales?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacionesGenerales?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ventanasDistintas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() modulosChecklist?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() infraestructuraChecklist?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() documentacionChecklist?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emisionElectronicaChecklist?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;

  // sub-entities
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActaFirmanteDto) firmantes?: ActaFirmanteDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActaFechaVisitaDto) fechasVisita?: ActaFechaVisitaDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActaCompromisoDto) compromisos?: ActaCompromisoDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActaParticipanteDto) participantes?: ActaParticipanteDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActaAccionDto) acciones?: ActaAccionDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActaContactoDto) contactos?: ActaContactoDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActaActividadDto) actaActividades?: ActaActividadDto[];
}

export class UpdateActaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() numero?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() fecha?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ciudad?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() municipioId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lugar?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() asunto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() objetivoGeneral?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() alcance?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() implementadorNombre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() jefeNombre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() actividadesRealizadas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cuerpo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cierreModulosJson?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() moduloId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() expositor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() temasCapacitacion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horaInicio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horaFin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nitCliente?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sedes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() responsableImplementador?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() responsableSoporte?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() capacitacionModalidad?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) capacitacionHoras?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() capacitacionPruebas?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() requerimientosAdicionales?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacionesGenerales?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ventanasDistintas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() modulosChecklist?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() infraestructuraChecklist?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() documentacionChecklist?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emisionElectronicaChecklist?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActaFirmanteDto) firmantes?: ActaFirmanteDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActaFechaVisitaDto) fechasVisita?: ActaFechaVisitaDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActaCompromisoDto) compromisos?: ActaCompromisoDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActaParticipanteDto) participantes?: ActaParticipanteDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActaAccionDto) acciones?: ActaAccionDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActaContactoDto) contactos?: ActaContactoDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ActaActividadDto) actaActividades?: ActaActividadDto[];
}
