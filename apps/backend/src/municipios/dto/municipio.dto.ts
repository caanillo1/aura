import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateMunicipioDto {
  @ApiProperty() @IsString() @IsNotEmpty() codigoDepartamento: string;
  @ApiProperty() @IsString() @IsNotEmpty() nombreDepartamento: string;
  @ApiProperty() @IsString() @IsNotEmpty() codigoMunicipio: string;
  @ApiProperty() @IsString() @IsNotEmpty() nombreMunicipio: string;
  @ApiPropertyOptional() @IsOptional() @IsString() codigoPostal?: string;
}

export class UpdateMunicipioDto {
  @ApiPropertyOptional() @IsOptional() @IsString() codigoDepartamento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nombreDepartamento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() codigoMunicipio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nombreMunicipio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() codigoPostal?: string;
}

export class MunicipioFilterDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() departamento?: string;
}
