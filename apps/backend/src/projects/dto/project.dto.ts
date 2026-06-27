import { IsString, IsOptional, IsUUID, IsNumber, Min, Max, IsDateString, IsIn, ValidateNested, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ModuleDateDto {
  @ApiProperty() @IsUUID() moduleId: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
}

export class GenerateProjectDto {
  @ApiProperty() @IsUUID() templateFlowId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PhaseDateDto)
  phaseDates?: PhaseDateDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsUUID(undefined, { each: true })
  excludedModuleIds?: string[];
}

export class PhaseDateDto {
  @ApiProperty() @IsUUID() templatePhaseId: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() agentLeaderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientLeaderId?: string;
}

export class LoadTemplateDto {
  @ApiProperty() @IsUUID() templateFlowId: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PhaseDateDto)
  phaseDates?: PhaseDateDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsUUID(undefined, { each: true })
  excludedModuleIds?: string[];
}

export class AddModulesDto {
  @ApiProperty() @IsUUID() templateFlowId: string;
  @ApiProperty() @IsArray() @IsUUID(undefined, { each: true }) selectedModuleIds: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PhaseDateDto)
  phaseDates?: PhaseDateDto[];
}

export class ProjectFilterDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

export class UpdateProjectStatusDto {
  @ApiProperty() @IsString() @IsIn(['activo','pausado','completado','cancelado']) status: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class UpdateDatosInformeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() motivoRetraso?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['Cliente','IHCE','Compartido','']) responsableRetraso?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() accionRequerida?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() nuevaFechaEstimada?: string;
}

export class UpdateModuleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['asistencial','financiero','mixto']) tipo?: string;
}

export class UpdatePhaseDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['pendiente','en_progreso','completado','bloqueado']) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() executionDate?: string;
}

export class UpdateActivityDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['pendiente','en_progreso','completado','bloqueado']) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) @Type(() => Number) progressPercent?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) actualHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() observations?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() plannedStartDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() plannedEndDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() actualStartDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() actualEndDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() executionDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedToId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientStaffId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['cliente','desarrollo','implementador']) blockedBy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() blockedNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unlockNote?: string;
}

export class CreateProjectActivityDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['baja','media','alta','critica']) priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) plannedHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() plannedStartDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() plannedEndDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() actualStartDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() actualEndDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedToId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientStaffId?: string;
}

export class GlobalActivitiesFilterDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : value ? [value] : undefined)
  status?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() clientId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateTo?: string;
}

export class SendActivityReportDto {
  @ApiProperty() @IsArray() @IsString({ each: true }) emails: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() subject?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() message?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : value ? [value] : undefined)
  status?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() clientId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) agentIds?: string[];
}

export class RecipientConfigDto {
  @ApiProperty() @IsString() email: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) agentIds?: string[];
}

export class SaveActivityScheduleDto {
  @ApiProperty() @IsBoolean() @Transform(({ value }) => value === true || value === 'true') enabled: boolean;
  @ApiProperty() @IsArray() @IsNumber({}, { each: true }) @Type(() => Number) diasSemana: number[];
  @ApiProperty() @IsNumber() @Min(0) @Max(23) @Type(() => Number) hora: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(59) @Type(() => Number) minuto: number;
  @ApiProperty() @IsArray() @IsString({ each: true }) status: string[];
  @ApiProperty() @IsArray() @ValidateNested({ each: true }) @Type(() => RecipientConfigDto) destinatarios: RecipientConfigDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() asunto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mensaje?: string;
}
