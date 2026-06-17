import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() jobTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() roleSlug?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string;
  @ApiPropertyOptional({ enum: ['agent', 'client'] })
  @IsOptional() @IsIn(['agent', 'client']) userType?: 'agent' | 'client';
}

export class ResetPasswordDto {
  @ApiPropertyOptional({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
