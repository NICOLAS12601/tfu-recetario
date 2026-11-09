import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { ListaDeComprasModule } from './lista-de-compras/lista-de-compras.module.js';
import { ApiPreciosModule } from './api-precios/api-precios.module.js';
import { RecetaService } from './receta/receta.service.js';
import { publicarServicioSoap } from './receta/disponibilidad.soap.js';

// Un solo código, tres servicios: SERVICE elige qué módulo arranca este
// proceso. Cada contenedor corre la misma imagen con otro SERVICE.
const SERVICIOS = {
  'inventario-recetas': AppModule,
  'lista-compras': ListaDeComprasModule,
  precios: ApiPreciosModule,
};

async function bootstrap() {
  const servicio = (process.env.SERVICE ?? 'inventario-recetas') as keyof typeof SERVICIOS;
  const app = await NestFactory.create(SERVICIOS[servicio]);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  await app.listen(process.env.PORT ?? 3000);
  if (servicio === 'inventario-recetas') {
    publicarServicioSoap(app.getHttpServer(), app.get(RecetaService));
  }
}
await bootstrap();
