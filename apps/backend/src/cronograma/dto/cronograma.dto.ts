import { IsString, IsOptional, IsDateString, IsUUID, Matches, IsIn, IsNotEmpty } from 'class-validator';

export class CreateBloqueDto {
  @IsString() titulo: string;
  @IsDateString() fecha: string;
  @Matches(/^\d{2}:\d{2}$/) horaInicio: string;
  @Matches(/^\d{2}:\d{2}$/) horaFin: string;
  @IsUUID() agenteId: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() serviceOrderId?: string;
  @IsOptional() @IsString() notas?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsIn(['inicio','visita','cierre','capacitacion','entrega_soporte']) tipoActa?: string;
}

export class UpdateBloqueDto {
  @IsOptional() @IsString() titulo?: string;
  @IsOptional() @IsDateString() fecha?: string;
  @IsOptional() @Matches(/^\d{2}:\d{2}$/) horaInicio?: string;
  @IsOptional() @Matches(/^\d{2}:\d{2}$/) horaFin?: string;
  @IsOptional() @IsUUID() agenteId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() serviceOrderId?: string;
  @IsOptional() @IsString() notas?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsIn(['programado','en_curso','completado','cancelado']) status?: string;
  @IsOptional() @IsUUID() actaId?: string;
  @IsOptional() @IsIn(['inicio','visita','cierre','capacitacion','entrega_soporte']) tipoActa?: string;
}

export class BloqueFilterDto {
  @IsOptional() @IsUUID() agenteId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsDateString() fechaDesde?: string;
  @IsOptional() @IsDateString() fechaHasta?: string;
  @IsOptional() @IsString() tipoActa?: string;
  @IsOptional() @IsString() status?: string;
}

export class RespondVisitDto {
  @IsString() @IsNotEmpty() token: string;
  @IsIn(['accept', 'cancel']) action: 'accept' | 'cancel';
  @IsString() @IsNotEmpty() documento: string;
  @IsOptional() @IsString() motivo?: string;
}
