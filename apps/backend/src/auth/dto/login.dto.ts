import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@infotec.com' })
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Admin@2024!' })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}
