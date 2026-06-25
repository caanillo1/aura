import {
  IsString, IsOptional, IsUUID, IsDateString, IsArray,
  ValidateNested, IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class InvitadoDto {
  @ApiProperty()    @IsString()              nombre: string;
  @ApiProperty()    @IsEmail()               email: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  cargo?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID()    clientStaffId?: string;
}

export class CreateSesionDto {
  @ApiProperty()    @IsUUID()       projectId: string;
  @ApiProperty()    @IsUUID()       companyId: string;
  @ApiProperty()    @IsString()     titulo: string;
  @ApiProperty()    @IsDateString() fecha: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID()   moduloId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() expositor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() temas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lugar?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() teamsLink?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvitadoDto)
  invitados?: InvitadoDto[];
}

export class UpdateSesionDto {
  @ApiPropertyOptional() @IsOptional() @IsString()     titulo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() fecha?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID()       moduloId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()     expositor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()     temas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()     lugar?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()     teamsLink?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()     estado?: string;
}

export class EntrarSalaDto {
  @ApiProperty()    @IsString()              nombre: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail()  email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() documento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cargo?: string;
}
