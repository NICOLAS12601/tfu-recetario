import { Body, Controller, Post } from '@nestjs/common';
import { ApiPreciosService } from './api-precios.service.js';

/**
 * Consulta agrupada: todos los productos en UNA llamada.
 * POST /precios { "productos": ["Carne", "Pan"] } -> { "Carne": 452, "Pan": 61 }
 */
@Controller('precios')
export class ApiPreciosController {
  constructor(private readonly apiPreciosService: ApiPreciosService) {}

  @Post()
  async obtenerPrecios(@Body() body: { productos: string[] }) {
    const precios: Record<string, number> = {};
    await Promise.all(
      body.productos.map(async (nombre) => {
        precios[nombre] = await this.apiPreciosService.obtenerPrecio(nombre);
      }),
    );
    return precios;
  }
}
