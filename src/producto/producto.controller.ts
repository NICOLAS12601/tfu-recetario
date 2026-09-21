import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ProductoService } from './producto.service.js';
import { CreateProductoDto } from './dto/create-producto.dto.js';
import { ConsumirStockDto } from './dto/consumir-stock.dto.js';

@Controller('productos')
export class ProductoController {
  constructor(private readonly productoService: ProductoService) {}

  @Post()
  crear(@Body() dto: CreateProductoDto) {
    return this.productoService.crear(dto);
  }

  @Get()
  listar() {
    return this.productoService.listar();
  }

  @Get(':id')
  obtenerPorId(@Param('id') id: string) {
    return this.productoService.obtenerPorId(id);
  }

  @Patch(':id/consumir-stock')
  consumirStock(@Param('id') id: string, @Body() dto: ConsumirStockDto) {
    return this.productoService.consumirStock(id, dto.cantidad);
  }

  @Patch(':id/reponer-stock')
  reponerStock(@Param('id') id: string, @Body() dto: ConsumirStockDto) {
    return this.productoService.reponerStock(id, dto.cantidad);
  }
}
