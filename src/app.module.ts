import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProductoModule } from './producto/producto.module.js';
import { RecetaModule } from './receta/receta.module.js';
import { ApiPreciosModule } from './api-precios/api-precios.module.js';
import { ListaDeComprasModule } from './lista-de-compras/lista-de-compras.module.js';

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
    ApiPreciosModule,
    ListaDeComprasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
