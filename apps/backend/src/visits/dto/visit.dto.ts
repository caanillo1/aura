import {
  IsString, IsOptional, IsUUID, IsDateString, IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVisitDto {
  @ApiProperty() @IsUUID() projectId: string;

  @ApiPropertyOptional() @IsOptional() @IsString() visitType?: string;
  @ApiProperty()         @IsDateString() visitDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() startTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() endTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() objective?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() activitiesDone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() commitments?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observations?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsUUID(undefined, { each: true })
  activityIds?: string[];
}

export class UpdateVisitDto {
  @ApiPropertyOptional() @IsOptional() @IsString() visitType?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() visitDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() startTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() endTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() objective?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() activitiesDone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() commitments?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observations?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsUUID(undefined, { each: true })
  activityIds?: string[];
}

export class FilterVisitDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID()       projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()     status?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}
