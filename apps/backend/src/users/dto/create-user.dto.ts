import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ enum: ['agent', 'client'] })
  @IsIn(['agent', 'client'])
  userType: 'agent' | 'client';

  @ApiProperty() @IsString() @IsNotEmpty() document: string;
  @ApiProperty() @IsString() @IsNotEmpty() firstName: string;
  @ApiProperty() @IsString() @IsNotEmpty() lastName: string;

  @ApiProperty() @IsEmail() email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: 'Slug del rol a asignar' })
  @IsString()
  @IsNotEmpty()
  roleSlug: string;

  @ApiPropertyOptional() @IsOptional() @IsString() jobTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;

  @ApiPropertyOptional({ description: 'ID del cliente (si userType=client)' })
  @IsOptional()
  @IsUUID()
  clientId?: string;
}
