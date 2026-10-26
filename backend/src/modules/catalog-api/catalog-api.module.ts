import { Module } from '@nestjs/common';
import { CatalogApiService } from './catalog-api.service';
import { CatalogApiController } from './catalog-api.controller';

@Module({
  controllers: [CatalogApiController],
  providers: [CatalogApiService],
})
export class CatalogApiModule {}