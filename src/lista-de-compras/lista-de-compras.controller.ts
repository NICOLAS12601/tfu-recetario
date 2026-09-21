import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ListaDeComprasService } from './lista-de-compras.service.js';
import { GenerarListaDto } from './dto/generar-lista.dto.js';

@Controller('lista-de-compras')
export class ListaDeComprasController {
  constructor(private readonly listaDeComprasService: ListaDeComprasService) {}

  @Get('receta/:recetaId')
  generarParaReceta(@Param('recetaId') recetaId: string) {
    return this.listaDeComprasService.generar([recetaId]);
  }

  @Post()
  generar(@Body() dto: GenerarListaDto) {
    return this.listaDeComprasService.generar(dto.recetaIds);
  }
}
