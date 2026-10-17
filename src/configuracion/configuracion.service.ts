import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Configuracion } from './configuracion.entity.js';
import {
  CONFIGURACION_POR_DEFECTO,
  INTERVALO_DE_REFRESCO_MS,
} from './configuracion.constants.js';

/**
 * External Configuration Store.
 *
 * La fuente de verdad es la tabla `configuracion`. La API mantiene una copia
 * local en memoria que refresca cada pocos segundos, para que los demás
 * patrones lean sus parámetros de forma síncrona y barata (sin pegarle a la
 * base en cada request). Al actualizar por la API se refresca al instante, así
 * el cambio se ve sin esperar al próximo ciclo.
 */
@Injectable()
export class ConfiguracionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConfiguracionService.name);

  private readonly copiaLocal = new Map<string, string>();
  private temporizadorDeRefresco?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Configuracion)
    private readonly configuracionRepository: Repository<Configuracion>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.sembrarValoresPorDefecto();
    await this.refrescar();
    this.temporizadorDeRefresco = setInterval(
      () => void this.refrescar(),
      INTERVALO_DE_REFRESCO_MS,
    );
  }

  onModuleDestroy(): void {
    if (this.temporizadorDeRefresco) {
      clearInterval(this.temporizadorDeRefresco);
    }
  }

  listar(): Promise<Configuracion[]> {
    return this.configuracionRepository.find({ order: { clave: 'ASC' } });
  }

  getTexto(clave: string, valorPorDefecto: string): string {
    return this.copiaLocal.get(clave) ?? valorPorDefecto;
  }

  getNumero(clave: string, valorPorDefecto: number): number {
    const valor = this.copiaLocal.get(clave);
    if (valor === undefined) {
      return valorPorDefecto;
    }
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : valorPorDefecto;
  }

  async actualizar(clave: string, valor: string): Promise<Configuracion> {
    if (!(clave in CONFIGURACION_POR_DEFECTO)) {
      throw new BadRequestException(`Configuración desconocida: ${clave}`);
    }
    if (!Number.isFinite(Number(valor))) {
      throw new BadRequestException(`"${clave}" espera un valor numérico`);
    }

    await this.configuracionRepository.save({ clave, valor });
    await this.refrescar();

    const actualizada = await this.configuracionRepository.findOneBy({ clave });
    if (!actualizada) {
      throw new NotFoundException(
        `No se pudo guardar la configuración ${clave}`,
      );
    }
    return actualizada;
  }

  private async sembrarValoresPorDefecto(): Promise<void> {
    for (const [clave, valor] of Object.entries(CONFIGURACION_POR_DEFECTO)) {
      const existente = await this.configuracionRepository.findOneBy({ clave });
      if (!existente) {
        await this.configuracionRepository.save({ clave, valor });
      }
    }
  }

  private async refrescar(): Promise<void> {
    try {
      const filas = await this.configuracionRepository.find();
      this.copiaLocal.clear();
      for (const fila of filas) {
        this.copiaLocal.set(fila.clave, fila.valor);
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo refrescar la configuración desde la base: ${
          (error as Error).message
        }`,
      );
    }
  }
}
