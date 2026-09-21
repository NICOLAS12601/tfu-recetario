import { Module } from '@nestjs/common';
import { ApiPreciosService } from './api-precios.service.js';

@Module({
  providers: [ApiPreciosService],
  exports: [ApiPreciosService],
})
export class ApiPreciosModule {}
