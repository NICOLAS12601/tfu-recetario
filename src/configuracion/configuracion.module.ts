import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Configuracion } from './configuracion.entity.js';
import { ConfiguracionService } from './configuracion.service.js';
import { ConfiguracionController } from './configuracion.controller.js';

/**
 * Es @Global para que cualquier componente (Api Precios, Lista de Compras y el
 * rate limit) lea sus parámetros sin importar el módulo explícitamente: es un
 * servicio transversal, no un componente de dominio.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Configuracion])],
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}
