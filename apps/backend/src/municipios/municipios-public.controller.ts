import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MunicipiosService } from './municipios.service';

@ApiTags('Municipios')
@Controller('municipios-public')
export class MunicipiosPublicController {
  constructor(private readonly svc: MunicipiosService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Catálogo público de municipios (sin autenticación, para registro)' })
  findCatalog() {
    return this.svc.findPublicCatalog();
  }
}
