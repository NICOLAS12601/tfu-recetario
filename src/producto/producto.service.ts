import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { DataSource, Repository } from 'typeorm';
import { Producto } from './producto.entity.js';
import type { IProductoStock } from './producto.contract.js';
import type { CreateProductoDto } from './dto/create-producto.dto.js';

@Injectable()
export class ProductoService implements IProductoStock {
  constructor(
    @InjectRepository(Producto)
    private readonly productoRepository: Repository<Producto>,
    private readonly dataSource: DataSource,
  ) {}

  crear(dto: CreateProductoDto): Promise<Producto> {
    const producto = this.productoRepository.create(dto);
    return this.productoRepository.save(producto);
  }

  listar(): Promise<Producto[]> {
    return this.productoRepository.find();
  }

  async obtenerPorId(id: string): Promise<Producto> {
    const producto = await this.productoRepository.findOneBy({ id });
    if (!producto) {
      throw new NotFoundException(`Producto ${id} no existe`);
    }
    return producto;
  }

  /**
   * Descuenta stock dentro de SU PROPIA transacción.
   * Usa un lock pesimista (SELECT ... FOR UPDATE) para que dos requests
   * concurrentes no lean el mismo stock viejo y lo dejen negativo
   * (la condición de carrera que motiva usar ACID acá).
   */
  async consumirStock(id: string, cantidad: number): Promise<Producto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await this.consumirStockEnTransaccion(queryRunner.manager, id, cantidad);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
    return this.obtenerPorId(id);
  }

  /**
   * Misma operación pero recibiendo el EntityManager de una transacción
   * ya abierta por otro componente (ver Receta.cocinar, que necesita
   * descontar varios productos como una sola unidad atómica).
   */
  async consumirStockEnTransaccion(
    manager: EntityManager,
    id: string,
    cantidad: number,
  ): Promise<void> {
    const repo = manager.getRepository(Producto);
    const producto = await repo.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!producto) {
      throw new NotFoundException(`Producto ${id} no existe`);
    }
    if (producto.stock < cantidad) {
      throw new ConflictException(
        `Stock insuficiente de "${producto.nombre}": hay ${producto.stock}, se pidieron ${cantidad}`,
      );
    }
    producto.stock -= cantidad;
    await repo.save(producto);
  }

  async reponerStock(id: string, cantidad: number): Promise<Producto> {
    const producto = await this.obtenerPorId(id);
    producto.stock += cantidad;
    return this.productoRepository.save(producto);
  }
}
