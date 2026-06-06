import {
  IsEmail, IsNotEmpty, IsString, IsIn,
  IsOptional, MinLength, ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  // ── TIPO DE USUARIO ───────────────────────────────────────────────────────
  @ApiProperty({ enum: ['agent', 'client'], example: 'client' })
  @IsIn(['agent', 'client'])
  userType: 'agent' | 'client';

  // ── DATOS PERSONALES ──────────────────────────────────────────────────────
  @ApiProperty({ example: '12345678' })
  @IsString()
  @IsNotEmpty()
  document: string;

  @ApiProperty({ example: 'Carlos' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Anillo' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'carlos@empresa.com' })
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  email: string;

  @ApiProperty({ example: 'Admin@2024!' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @ApiProperty({ required: false, example: 'Coordinador de Implementación' })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  // ── AGENTE: contraseña especial ───────────────────────────────────────────
  @ApiProperty({ required: false, description: 'Requerida para tipo agent' })
  @ValidateIf((o) => o.userType === 'agent')
  @IsString()
  @IsNotEmpty({ message: 'La contraseña de registro de agente es requerida' })
  agentRegPassword?: string;

  // ── CLIENTE: empresa existente (por ID) ───────────────────────────────────
  @ApiProperty({ required: false, description: 'ID de empresa cliente existente' })
  @IsOptional()
  @IsString()
  clientId?: string;

  // ── CLIENTE: NIT para buscar empresa existente O crear nueva ─────────────
  // Si viene solo el NIT (sin companyBusinessName) → lookup por NIT
  // Si vienen NIT + razón social → crear empresa nueva
  @ApiProperty({ required: false, example: '900123456-7' })
  @ValidateIf((o) => o.userType === 'client' && !o.clientId)
  @IsString()
  @IsNotEmpty({ message: 'El NIT de la empresa es requerido' })
  companyNit?: string;

  @ApiProperty({ required: false, example: 'Hospital San Jorge S.A.S', description: 'Requerida solo al crear empresa nueva' })
  @IsOptional()
  @IsString()
  companyBusinessName?: string;

  @ApiProperty({ required: false, example: 'Hospital San Jorge' })
  @IsOptional()
  @IsString()
  companyCommercialName?: string;

  @ApiProperty({ required: false, example: 'Cra 15 #23-45' })
  @IsOptional()
  @IsString()
  companyAddress?: string;

  @ApiProperty({ required: false, example: 'Pereira' })
  @IsOptional()
  @IsString()
  companyCity?: string;

  @ApiProperty({ required: false, example: 'Risaralda' })
  @IsOptional()
  @IsString()
  companyDepartment?: string;

  @ApiProperty({ required: false, example: 'contacto@hospital.com' })
  @IsOptional()
  @IsEmail()
  companyEmail?: string;

  @ApiProperty({ required: false, example: '3101234567' })
  @IsOptional()
  @IsString()
  companyPhone?: string;

  @ApiProperty({ required: false, example: 'Servicios de salud' })
  @IsOptional()
  @IsString()
  companyEconomicActivity?: string;
}
