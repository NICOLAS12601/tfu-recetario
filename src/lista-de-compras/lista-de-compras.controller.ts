import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ListaDeComprasService } from './lista-de-compras.service.js';
import { GenerarListaDto } from './dto/generar-lista.dto.js';

const solicitudes = new Map();

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

  @Post('solicitudes')
  solicitar(@Body() dto: GenerarListaDto, @Res() res: Response) {
    const id = randomUUID();
    solicitudes.set(id, { estado: 'pendiente' });

    this.listaDeComprasService
      .generar(dto.recetaIds)
      .then((lista) => solicitudes.set(id, { estado: 'terminada', lista }))
      .catch((error) => solicitudes.set(id, { estado: 'fallida', error: error.message }));

    res
      .status(202)
      .location(`/lista-de-compras/solicitudes/${id}`)
      .set('Retry-After', '1')
      .json({ id, estado: 'pendiente' });
  }

  @Get('solicitudes/:id')
  consultar(@Param('id') id: string, @Res() res: Response) {
    const solicitud = solicitudes.get(id);

    if (!solicitud) {
      res.status(404).json({ message: 'Solicitud no encontrada' });
      return;
    }

    if (solicitud.estado === 'pendiente') {
      res.status(202).set('Retry-After', '1').json(solicitud);
      return;
    }

    res.status(200).json(solicitud);
  }

}
