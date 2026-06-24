import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
  UseInterceptors, UploadedFile, Res, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard }   from '../common/guards/roles.guard';
import { Roles }        from '../common/decorators/roles.decorator';
import { GetUser }      from '../common/decorators/get-user.decorator';
import type { JwtUser } from '../common/decorators/get-user.decorator';
import { FaqService }   from './faq.service';
import {
  CreateFaqTipoDto, UpdateFaqTipoDto,
  CreateFaqDto, UpdateFaqDto, FaqFilterDto,
} from './dto/faq.dto';


const faqFileStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const dir = join(process.cwd(), 'uploads', 'faq');
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${extname(file.originalname)}`);
  },
});

const IMPL_ROLES = ['admin','coordinator','implementer_clinical','implementer_financial','implementer_support'] as const;
const ALL_ROLES  = [...IMPL_ROLES, 'support', 'client'] as const;

@ApiTags('FAQ')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('faq')
export class FaqController {
  constructor(private readonly svc: FaqService) {}

  // ── Tipos ─────────────────────────────────────────────────────────────────

  @Get('tipos')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Listar tipos de FAQ' })
  getTipos(@GetUser() user: JwtUser) {
    return this.svc.getTipos(user.companyId);
  }

  @Post('tipos')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Crear tipo de FAQ' })
  createTipo(@GetUser() user: JwtUser, @Body() dto: CreateFaqTipoDto) {
    return this.svc.createTipo(user.companyId, dto);
  }

  @Patch('tipos/:id')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Actualizar tipo de FAQ' })
  updateTipo(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateFaqTipoDto) {
    return this.svc.updateTipo(user.companyId, id, dto);
  }

  @Delete('tipos/:id')
  @Roles('admin', 'coordinator')
  @ApiOperation({ summary: 'Eliminar tipo de FAQ' })
  deleteTipo(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.deleteTipo(user.companyId, id);
  }

  // ── FAQs ──────────────────────────────────────────────────────────────────

  @Get()
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Listar FAQs' })
  getFaqs(@GetUser() user: JwtUser, @Query() filter: FaqFilterDto) {
    return this.svc.getFaqs(user.companyId, filter);
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Obtener FAQ por ID' })
  getFaq(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.getFaq(user.companyId, id);
  }

  @Post()
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Crear FAQ' })
  createFaq(@GetUser() user: JwtUser, @Body() dto: CreateFaqDto) {
    return this.svc.createFaq(user.companyId, user.id, dto);
  }

  @Patch(':id')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Actualizar FAQ' })
  updateFaq(@GetUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateFaqDto) {
    return this.svc.updateFaq(user.companyId, id, dto);
  }

  @Delete(':id')
  @Roles(...IMPL_ROLES)
  @ApiOperation({ summary: 'Eliminar FAQ' })
  deleteFaq(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.deleteFaq(user.companyId, id);
  }

  // ── Archivos adjuntos ─────────────────────────────────────────────────────

  @Post('upload-file')
  @Roles(...IMPL_ROLES)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir archivo Excel/CSV para adjuntar en FAQ (máx 30 MB)' })
  @UseInterceptors(FileInterceptor('file', {
    storage: faqFileStorage,
    limits: { fileSize: 30 * 1024 * 1024 },
  }))
  uploadFile(
    @GetUser() _user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    return {
      filename:     file.filename,
      originalName: file.originalname,
      size:         file.size,
      url:          `/faq/files/${file.filename}`,
    };
  }

  @Get('files/:filename')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Descargar archivo adjunto de FAQ' })
  downloadFile(
    @GetUser() _user: JwtUser,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    return this.svc.streamFile(filename, res);
  }
}
