import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Receta } from './receta.entity.js';
import { RecetaIngrediente } from './receta-ingrediente.entity.js';
import { RecetaService } from './receta.service.js';
import { RecetaController } from './receta.controller.js';
import { ProductoModule } from '../producto/producto.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Receta, RecetaIngrediente]),
    ProductoModule,
  ],
  controllers: [RecetaController],
  providers: [RecetaService],
  exports: [RecetaService],
})
export class RecetaModule {}
