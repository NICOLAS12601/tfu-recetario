import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfiguracionService } from './configuracion.service.js';
import { Configuracion } from './configuracion.entity.js';
import { CONFIGURACION_POR_DEFECTO } from './configuracion.constants.js';

/**
 * Repositorio en memoria con la parte de la API de TypeORM que usa el
 * servicio. Evita depender de Postgres en el test unitario.
 */
class RepositorioEnMemoria {
  private readonly filas = new Map<string, Configuracion>();

  async findOneBy({ clave }: { clave: string }): Promise<Configuracion | null> {
    return this.filas.get(clave) ?? null;
  }

  async find(): Promise<Configuracion[]> {
    return [...this.filas.values()];
  }

  async save(
    fila: Pick<Configuracion, 'clave' | 'valor'>,
  ): Promise<Configuracion> {
    const completa: Configuracion = {
      clave: fila.clave,
      valor: fila.valor,
      actualizadoEn: new Date(),
    };
    this.filas.set(fila.clave, completa);
    return completa;
  }
}

describe('ConfiguracionService', () => {
  let servicio: ConfiguracionService;

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({
      providers: [
        ConfiguracionService,
        {
          provide: getRepositoryToken(Configuracion),
          useValue: new RepositorioEnMemoria(),
        },
      ],
    }).compile();

    servicio = modulo.get(ConfiguracionService);
    await servicio.onModuleInit();
  });

  afterEach(() => {
    servicio.onModuleDestroy();
  });

  it('siembra todos los valores por defecto al arrancar', async () => {
    const filas = await servicio.listar();
    expect(filas).toHaveLength(Object.keys(CONFIGURACION_POR_DEFECTO).length);
  });

  it('devuelve el valor numérico vigente o el valor por defecto', () => {
    expect(servicio.getNumero('retry_intentos', 999)).toBe(3);
    expect(servicio.getNumero('clave-inexistente', 42)).toBe(42);
  });

  it('actualiza un valor y refresca la copia local de inmediato', async () => {
    await servicio.actualizar('retry_intentos', '7');
    expect(servicio.getNumero('retry_intentos', 3)).toBe(7);
  });

  it('rechaza claves de configuración desconocidas', async () => {
    await expect(
      servicio.actualizar('clave-inexistente', '1'),
    ).rejects.toThrow();
  });

  it('rechaza valores no numéricos', async () => {
    await expect(
      servicio.actualizar('retry_intentos', 'muchos'),
    ).rejects.toThrow();
  });
});
