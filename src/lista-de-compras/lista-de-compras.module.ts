import { Module } from '@nestjs/common';
import { ListaDeComprasService } from './lista-de-compras.service.js';
import { ListaDeComprasController } from './lista-de-compras.controller.js';
import { RecetaModule } from '../receta/receta.module.js';
import { ApiPreciosModule } from '../api-precios/api-precios.module.js';

@Module({
  imports: [RecetaModule, ApiPreciosModule],
  controllers: [ListaDeComprasController],
  providers: [ListaDeComprasService],
})
export class ListaDeComprasModule {}
