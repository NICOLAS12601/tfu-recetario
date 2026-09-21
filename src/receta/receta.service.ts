import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Receta } from './receta.entity.js';
import { RecetaIngrediente } from './receta-ingrediente.entity.js';
import type {
  DetalleReceta,
  Disponibilidad,
  IngredienteEstado,
  IRecetaConsulta,
} from './receta.contract.js';
import type { CreateRecetaDto } from './dto/create-receta.dto.js';
import { ProductoService } from '../producto/producto.service.js';

@Injectable()
export class RecetaService implements IRecetaConsulta {
  constructor(
    @InjectRepository(Receta)
    private readonly recetaRepository: Repository<Receta>,
    @InjectRepository(RecetaIngrediente)
    private readonly ingredienteRepository: Repository<RecetaIngrediente>,
    private readonly productoService: ProductoService,
    private readonly dataSource: DataSource,
  ) {}

  async crear(dto: CreateRecetaDto): Promise<Receta> {
    const ingredientes = await Promise.all(
      dto.ingredientes.map(async (i) => {
        const producto = await this.productoService.obtenerPorId(i.productoId);
        const ingrediente = this.ingredienteRepository.create({
          producto,
          cantidad: i.cantidad,
        });
        return ingrediente;
      }),
    );
    const receta = this.recetaRepository.create({
      nombre: dto.nombre,
      ingredientes,
    });
    return this.recetaRepository.save(receta);
  }

  listar(): Promise<Receta[]> {
    return this.recetaRepository.find();
  }

  async obtenerPorId(id: string): Promise<Receta> {
    const receta = await this.recetaRepository.findOneBy({ id });
    if (!receta) {
      throw new NotFoundException(`Receta ${id} no existe`);
    }
    return receta;
  }

  /**
   * Calcula, para cada ingrediente de la receta, cuánto se necesita vs.
   * cuánto hay ahora mismo en stock. Es la base tanto de
   * verificarDisponibilidad() (solo lo que falta) como de
   * obtenerDetalle() (todos los ingredientes, falten o no).
   */
  private async calcularEstadoIngredientes(
    receta: Receta,
  ): Promise<IngredienteEstado[]> {
    const estados: IngredienteEstado[] = [];
    for (const ri of receta.ingredientes) {
      const producto = await this.productoService.obtenerPorId(ri.producto.id);
      estados.push({
        productoId: producto.id,
        nombre: producto.nombre,
        necesario: ri.cantidad,
        disponible: producto.stock,
        faltante: Math.max(0, ri.cantidad - producto.stock),
      });
    }
    return estados;
  }

  /**
   * Solo lo que falta comprar. Lo consume Lista de Compras.
   */
  async verificarDisponibilidad(id: string): Promise<Disponibilidad> {
    const receta = await this.obtenerPorId(id);
    const estados = await this.calcularEstadoIngredientes(receta);
    const faltantes = estados.filter((e) => e.faltante > 0);
    return { disponible: faltantes.length === 0, faltantes };
  }

  /**
   * Detalle completo de la receta: TODOS los ingredientes (necesario,
   * disponible, faltante), no solo los que faltan. Pensado para mostrar
   * de una la receta combinada con su disponibilidad.
   */
  async obtenerDetalle(id: string): Promise<DetalleReceta> {
    const receta = await this.obtenerPorId(id);
    const ingredientes = await this.calcularEstadoIngredientes(receta);
    return {
      id: receta.id,
      nombre: receta.nombre,
      disponible: ingredientes.every((i) => i.faltante === 0),
      ingredientes,
    };
  }

  /**
   * Descuenta el stock de TODOS los ingredientes como una única unidad
   * atómica: si a cualquiera le falta stock, no se descuenta ninguno.
   * Por eso no alcanza con llamar consumirStock() de Producto ingrediente
   * por ingrediente (cada uno abriría su propia transacción); acá se abre
   * UNA transacción para toda la receta y se usa la variante
   * consumirStockEnTransaccion() de Producto para participar en ella.
   *
   * Los productos se lockean en orden por id para que dos "cocinar"
   * concurrentes con ingredientes en común no se deadlockeen entre sí.
   */
  async cocinar(id: string): Promise<Receta> {
    const receta = await this.obtenerPorId(id);
    const ingredientesOrdenados = [...receta.ingredientes].sort((a, b) =>
      a.producto.id.localeCompare(b.producto.id),
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const ri of ingredientesOrdenados) {
        await this.productoService.consumirStockEnTransaccion(
          queryRunner.manager,
          ri.producto.id,
          ri.cantidad,
        );
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
    return this.obtenerPorId(id);
  }
}
