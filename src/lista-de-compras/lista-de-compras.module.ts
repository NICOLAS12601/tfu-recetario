import { Module } from '@nestjs/common';
import { ListaDeComprasService } from './lista-de-compras.service.js';
import { ListaDeComprasController } from './lista-de-compras.controller.js';
import { InventarioSoapClient, PreciosHttpClient } from './clientes-remotos.js';

@Module({
  controllers: [ListaDeComprasController],
  providers: [ListaDeComprasService, InventarioSoapClient, PreciosHttpClient],
})
export class ListaDeComprasModule {}
