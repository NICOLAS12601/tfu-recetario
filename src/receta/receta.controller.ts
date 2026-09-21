import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RecetaService } from './receta.service.js';
import { CreateRecetaDto } from './dto/create-receta.dto.js';

@Controller('recetas')
export class RecetaController {
  constructor(private readonly recetaService: RecetaService) {}

  @Post()
  crear(@Body() dto: CreateRecetaDto) {
    return this.recetaService.crear(dto);
  }

  @Get()
  listar() {
    return this.recetaService.listar();
  }

  @Get(':id')
  obtenerPorId(@Param('id') id: string) {
    return this.recetaService.obtenerPorId(id);
  }

  @Get(':id/disponibilidad')
  verificarDisponibilidad(@Param('id') id: string) {
    return this.recetaService.verificarDisponibilidad(id);
  }

  @Get(':id/detalle')
  obtenerDetalle(@Param('id') id: string) {
    return this.recetaService.obtenerDetalle(id);
  }

  @Post(':id/cocinar')
  cocinar(@Param('id') id: string) {
    return this.recetaService.cocinar(id);
  }
}
