import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CatalogApiService } from './catalog-api.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('catalog')
export class CatalogApiController {
  constructor(private readonly catalogApiService: CatalogApiService) {}

  @Get('search')
  search(@Query('q') query?: string) {
    return this.catalogApiService.searchArtworks(query || 'painting');
  }
}