import {
  Controller, Post, Get, Body, UseGuards, Req,
  HttpCode, HttpStatus, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

class RefreshDto {
  @IsString() @IsNotEmpty() refreshToken: string;
}

@ApiTags('Auth')
@Controller('auth')

interface AuthRequest {
  user: { id: string; sub: string; email: string; companyId: string; role: string };
}
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesiÃ³n' })
  @ApiResponse({ status: 200, description: 'Login exitoso con tokens JWT' })
  @ApiResponse({ status: 401, description: 'Credenciales incorrectas' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo usuario (agente o cliente)' })
  @ApiResponse({ status: 201, description: 'Usuario registrado exitosamente' })
  @ApiResponse({ status: 409, description: 'El correo ya estÃ¡ registrado' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  getMe(@Req() req: AuthRequest) {
    return this.authService.getMe(req.user.id);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesiÃ³n' })
  logout(@Req() req: AuthRequest) {
    return this.authService.logout(req.user.id);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refrescar access token con refresh token' })
  @ApiResponse({ status: 200, description: 'Nuevos tokens generados' })
  @ApiResponse({ status: 401, description: 'Refresh token invÃ¡lido o expirado' })
  async refresh(@Body() dto: RefreshDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      return this.authService.refreshTokens((payload as { sub: string }).sub, dto.refreshToken);
    } catch {
      throw new UnauthorizedException('SesiÃ³n expirada. Por favor inicia sesiÃ³n nuevamente.');
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check de la API' })
  health() {
    return { status: 'ok', timestamp: new Date().toISOString(), service: 'AURA ERP API v1' };
  }
}

