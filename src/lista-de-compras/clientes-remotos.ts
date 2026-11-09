import { Injectable, NotFoundException } from '@nestjs/common';
import * as soap from 'soap';

const TIMEOUT_MS = 2000;

/**
 * Antes Lista de Compras llamaba a RecetaService en memoria; ahora
 * Inventario y Recetas es otro proceso y se le habla por SOAP (WSDL).
 */
@Injectable()
export class InventarioSoapClient {
  private readonly url = process.env.INVENTARIO_SOAP_URL ?? 'http://localhost:8081/ws';
  private cliente?: soap.Client;

  async verificarDisponibilidad(recetaId: string) {
    // El cliente se arma leyendo el WSDL la primera vez que se usa.
    this.cliente ??= await soap.createClientAsync(`${this.url}?wsdl`, {
      endpoint: this.url,
      wsdl_options: { timeout: TIMEOUT_MS },
    });
    try {
      const [respuesta] = await this.cliente.consultarDisponibilidadAsync(
        { recetaId },
        { timeout: TIMEOUT_MS },
      );
      // Con un solo <faltante> la librería devuelve un objeto, no un array.
      const faltantes: { productoId: string; nombre: string; cantidadFaltante: string }[] =
        [respuesta?.faltante ?? []].flat();
      return {
        faltantes: faltantes.map((f) => ({
          productoId: f.productoId,
          nombre: f.nombre,
          faltante: Number(f.cantidadFaltante),
        })),
      };
    } catch (error) {
      // Inventario responde un SOAP Fault "soap:Client" si la receta no existe.
      const fault = (error as { root?: any }).root?.Envelope?.Body?.Fault;
      if (String(fault?.faultcode ?? '').includes('Client')) {
        throw new NotFoundException(`Receta ${recetaId} no existe`);
      }
      throw error;
    }
  }
}

/** Antes era ApiPreciosService en memoria; ahora es REST al Servicio de Precios. */
@Injectable()
export class PreciosHttpClient {
  private readonly url = process.env.PRECIOS_URL ?? 'http://localhost:8082';

  async obtenerPrecios(productos: string[]): Promise<Record<string, number>> {
    const respuesta = await fetch(`${this.url}/precios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productos }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!respuesta.ok) throw new Error(`Precios respondió ${respuesta.status}`);
    return (await respuesta.json()) as Record<string, number>;
  }
}
