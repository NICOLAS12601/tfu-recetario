import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { IPrecioProvider } from './api-precios.contract.js';
import { ConfiguracionService } from '../configuracion/configuracion.service.js';
import { CLAVES_DE_CONFIGURACION } from '../configuracion/configuracion.constants.js';

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
const PROBABILIDAD_DE_FALLA_POR_DEFECTO = 0.3;

/**
 * No pega a ninguna API real: simula la integración externa con precios
 * fijos + variación aleatoria, y una latencia artificial para que se
 * comporte como una llamada de red de verdad.
 *
 * La probabilidad de falla transitoria ya no es una constante: se lee del
 * external configuration store, para poder mostrar en vivo cómo el retry
 * (y la caché) la absorben.
 */
@Injectable()
export class ApiPreciosService implements IPrecioProvider {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  async obtenerPrecio(nombreProducto: string): Promise<number> {
    await this.simularLatenciaDeRed();
    this.simularFallaTransitoria();
    const clave = nombreProducto.trim().toLowerCase();
    const base = PRECIOS_BASE[clave] ?? this.precioBasePorNombre(clave);
    const variacion = 0.9 + Math.random() * 0.2; // +-10%
    return Math.round(base * variacion);
  }

  private simularFallaTransitoria(): void {
    const probabilidad = this.configuracionService.getNumero(
      CLAVES_DE_CONFIGURACION.precioProbabilidadFalla,
      PROBABILIDAD_DE_FALLA_POR_DEFECTO,
    );
    if (Math.random() < probabilidad) {
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
