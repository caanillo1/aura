import {
  IsString, IsNotEmpty, IsOptional, IsDateString, IsInt, IsUUID, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateServiceOrderDto {
  @ApiProperty() @IsUUID() clientId: string;
  @ApiProperty() @IsString() @IsNotEmpty() product: string;
  @ApiPropertyOptional() @IsOptional() @IsString() scope?: string;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Type(() => Number) durationDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clinicalLeaderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() financialLeaderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientLeaderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observations?: string;
}

export class UpdateServiceOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() product?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() scope?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Type(() => Number) durationDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clinicalLeaderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() financialLeaderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientLeaderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observations?: string;
}

export class ChangeStatusDto {
  @ApiProperty() @IsString() @IsNotEmpty() status: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class AddImplementerDto {
  @ApiProperty() @IsUUID() userId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() role?: string;
}

export class ServiceOrderFilterDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string;
}
