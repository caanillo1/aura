import { IsString, IsOptional, IsUUID, IsDateString, IsIn, IsArray, ValidateNested, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateItemDto {
  @IsString() descripcion: string;
  @IsNumber() @Min(0) cantidad: number;
  @IsNumber() @Min(0) valorUnitario: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) descuento?: number;
}

export class CreateCotizacionDto {
  @IsString() titulo: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsString() prospecto?: string;
  @IsOptional() @IsString() contacto?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsString() notas?: string;
  @IsOptional() @IsDateString() validHasta?: string;
  @IsOptional() @IsIn(['borrador','enviada','en_negociacion','aceptada','rechazada']) status?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateItemDto) items?: CreateItemDto[];
}

export class UpdateCotizacionDto {
  @IsOptional() @IsString() titulo?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsString() prospecto?: string;
  @IsOptional() @IsString() contacto?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsString() notas?: string;
  @IsOptional() @IsDateString() validHasta?: string;
  @IsOptional() @IsIn(['borrador','enviada','en_negociacion','aceptada','rechazada']) status?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateItemDto) items?: CreateItemDto[];
}

export class CotizacionFilterDto {
  @IsOptional() @IsIn(['borrador','enviada','en_negociacion','aceptada','rechazada']) status?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsString() search?: string;
}
