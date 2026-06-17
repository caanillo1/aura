import { IsEmail, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCompanyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() commercialName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logoData?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() primaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() secondaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() smtpHost?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(65535) smtpPort?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() smtpUser?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() smtpPassword?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() smtpFromName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() smtpFromEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emailSignature?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() filesBasePath?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agentRegPassword?: string;
}
