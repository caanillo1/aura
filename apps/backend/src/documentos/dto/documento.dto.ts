import { IsString, IsOptional, IsBoolean, IsInt, IsUUID, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateTipoDocumentoDto {
  @IsString() nombre: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() scope?: string;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) orden?: number;
}

export class UpdateTipoDocumentoDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() scope?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) orden?: number;
}

export class UploadArchivoDto {
  @IsUUID() tipoDocumentoId: string;
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() serviceOrderId?: string;
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  esInterno?: boolean;
}

export class ArchivoFilterDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() tipoDocumentoId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() serviceOrderId?: string;
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  esInterno?: boolean;
  @IsOptional() @IsString() fechaDesde?: string;
  @IsOptional() @IsString() fechaHasta?: string;
  @IsOptional() @IsInt() @Min(1) @Max(200) @Type(() => Number) limit?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
}
