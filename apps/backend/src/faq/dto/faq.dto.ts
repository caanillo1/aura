import {
  IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsUUID, IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateFaqTipoDto {
  @ApiProperty()        @IsString()  @IsNotEmpty() nombre: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  color?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  icono?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  descripcion?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt()     orden?: number;
}

export class UpdateFaqTipoDto {
  @ApiPropertyOptional() @IsOptional() @IsString()  nombre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  color?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  icono?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  descripcion?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt()     orden?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() activo?: boolean;
}

export class CreateFaqDto {
  @ApiProperty()         @IsString()  @IsNotEmpty() titulo: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  descripcion?: string;
  @ApiProperty()         @IsString()  @IsNotEmpty() contenido: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID()    tipoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray()   etiquetas?: string[];
}

export class UpdateFaqDto {
  @ApiPropertyOptional() @IsOptional() @IsString()  titulo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  descripcion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  contenido?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID()    tipoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray()   etiquetas?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() activo?: boolean;
}

export class FaqFilterDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID()   tipoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  soloActivos?: boolean;
}
