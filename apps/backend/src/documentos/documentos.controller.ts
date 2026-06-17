import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  UseGuards, UseInterceptors, UploadedFile, Res, ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import type { Response } from 'express';
import { DocumentosService } from './documentos.service';
import {
  CreateTipoDocumentoDto, UpdateTipoDocumentoDto,
  UploadArchivoDto, ArchivoFilterDto,
} from './dto/documento.dto';

const ALL_ROLES   = ['admin', 'coordinator', 'implementer_clinical', 'implementer_financial', 'implementer_support', 'support'] as const;
const ADMIN_COORD = ['admin', 'coordinator'] as const;

const multerStorage = diskStorage({
  destination: (req: any, _file, cb) => {
    const dir = join(process.cwd(), 'uploads', req.user?.companyId ?? 'unknown');
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext    = extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

@ApiTags('Documentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documentos')
export class DocumentosController {
  constructor(private readonly svc: DocumentosService) {}

  // ── Tipos ────────────────────────────────────────────────────────────────

  @Get('tipos')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Listar tipos de documento' })
  findAllTipos(@GetUser() user: JwtUser) {
    return this.svc.findAllTipos(user.companyId);
  }

  @Post('tipos')
  @Roles(...ADMIN_COORD)
  @ApiOperation({ summary: 'Crear tipo de documento' })
  createTipo(@GetUser() user: JwtUser, @Body() dto: CreateTipoDocumentoDto) {
    return this.svc.createTipo(user.companyId, dto);
  }

  @Put('tipos/:id')
  @Roles(...ADMIN_COORD)
  @ApiOperation({ summary: 'Actualizar tipo de documento' })
  updateTipo(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateTipoDocumentoDto) {
    return this.svc.updateTipo(user.companyId, id, dto);
  }

  @Delete('tipos/:id')
  @Roles(...ADMIN_COORD)
  @ApiOperation({ summary: 'Eliminar tipo de documento' })
  deleteTipo(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.deleteTipo(user.companyId, id);
  }

  // ── Archivos ─────────────────────────────────────────────────────────────

  @Get()
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Listar archivos del repositorio' })
  findAll(@GetUser() user: JwtUser, @Query() dto: ArchivoFilterDto) {
    return this.svc.findAll(user.companyId, dto);
  }

  @Post('upload')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Subir archivo al repositorio' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: multerStorage }))
  upload(
    @GetUser() user: JwtUser,
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 })] }))
    file: Express.Multer.File,
    @Body() dto: UploadArchivoDto,
  ) {
    return this.svc.upload(user.companyId, user.id, file, dto);
  }

  @Get(':id/download')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Descargar archivo' })
  download(@GetUser() user: JwtUser, @Param('id') id: string, @Res() res: Response) {
    return this.svc.download(user.companyId, id, res);
  }

  @Delete(':id')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Eliminar archivo' })
  remove(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.remove(user.companyId, id);
  }
}
