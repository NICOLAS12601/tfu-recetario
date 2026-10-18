import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { ConfiguracionService } from './configuracion/configuracion.service.js';
import { crearLimitadorDeSolicitudes } from './limitar-solicitudes.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // La API vive detrás del gateway (no publica puertos): hay que confiar en
  // X-Forwarded-For / X-Real-IP para que `req.ip` sea la IP real del cliente y
  // no la del contenedor de entrada (si no, el rate limit sería global).
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  // Rate limit montado como middleware de Express. El límite se resuelve desde
  // el external configuration store en cada request.
  const configuracionService = app.get(ConfiguracionService);
  app.use(crearLimitadorDeSolicitudes(configuracionService));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
