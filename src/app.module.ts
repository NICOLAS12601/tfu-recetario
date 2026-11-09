import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProductoModule } from './producto/producto.module.js';
import { RecetaModule } from './receta/receta.module.js';

// Servicio Inventario y Recetas (Producto + Receta): el único con base de
// datos, así cocinar sigue siendo una transacción ACID local.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'recetario'),
        password: config.get<string>('DB_PASSWORD', 'recetario'),
        database: config.get<string>('DB_NAME', 'recetario'),
        autoLoadEntities: true,
        // synchronize: solo para desarrollo/demo del TFU. En un proyecto
        // real esto se maneja con migraciones.
        synchronize: true,
      }),
    }),
    ProductoModule,
    RecetaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
