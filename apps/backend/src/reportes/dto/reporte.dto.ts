import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ReporteOrdenesDto {
  @IsOptional() @IsString() estado?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsString() fechaDesde?: string;
  @IsOptional() @IsString() fechaHasta?: string;
}

export class ReporteProyectosDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsUUID() clientId?: string;
}

export class ReporteCapacitacionesDto {
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() serviceOrderId?: string;
}

export class ReporteRequerimientosDto {
  @IsOptional() @IsString() estadoActual?: string;
  @IsOptional() @IsString() prioridad?: string;
  @IsOptional() @IsString() area?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() serviceOrderId?: string;
  @IsOptional() @IsString() fechaDesde?: string;
  @IsOptional() @IsString() fechaHasta?: string;
}
