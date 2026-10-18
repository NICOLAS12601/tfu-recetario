import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service.js';
import { ActualizarConfiguracionDto } from './dto/actualizar-configuracion.dto.js';

/**
 * Borde HTTP del External Configuration Store: permite leer los parámetros
 * vigentes y cambiarlos en caliente. Los cambios se persisten en la tabla y
 * se reflejan en la copia local de la API de inmediato.
 */
@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Get()
  listar() {
    return this.configuracionService.listar();
  }

  @Patch(':clave')
  actualizar(
    @Param('clave') clave: string,
    @Body() dto: ActualizarConfiguracionDto,
  ) {
    return this.configuracionService.actualizar(clave, dto.valor);
  }
}
