import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { IPrecioProvider } from './api-precios.contract.js';

const PRECIOS_BASE: Record<string, number> = {
  papa: 80,
  cebolla: 60,
  tomate: 120,
  carne: 450,
  pollo: 380,
  arroz: 90,
  fideos: 100,
  huevo: 15,
  leche: 70,
  pan: 65,
};
const PROBABILIDAD_DE_FALLA = 0.3;

/**
 * No pega a ninguna API real: simula la integración externa con precios
 * fijos + variación aleatoria, y una latencia artificial para que se
 * comporte como una llamada de red de verdad.
 */
@Injectable()
export class ApiPreciosService implements IPrecioProvider {
  async obtenerPrecio(nombreProducto: string): Promise<number> {
    await this.simularLatenciaDeRed();
    this.simularFallaTransitoria();
    const clave = nombreProducto.trim().toLowerCase();
    const base = PRECIOS_BASE[clave] ?? this.precioBasePorNombre(clave);
    const variacion = 0.9 + Math.random() * 0.2; // +-10%
    return Math.round(base * variacion);
  }

  private simularFallaTransitoria(): void {
    if(Math.random() < PROBABILIDAD_DE_FALLA) {
      throw new ServiceUnavailableException();
    }
  }

  private precioBasePorNombre(texto: string): number {
    let hash = 0;
    for (const char of texto) {
      hash = (hash * 31 + char.charCodeAt(0)) % 1000;
    }
    return 50 + hash;
  }

  private simularLatenciaDeRed(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 50));
  }
}
