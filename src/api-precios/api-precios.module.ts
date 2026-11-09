import { Module } from '@nestjs/common';
import { ApiPreciosService } from './api-precios.service.js';
import { ApiPreciosController } from './api-precios.controller.js';

@Module({
  controllers: [ApiPreciosController],
  providers: [ApiPreciosService],
  exports: [ApiPreciosService],
})
export class ApiPreciosModule {}
