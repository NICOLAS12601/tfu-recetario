import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Producto } from '../producto/producto.entity.js';
import { Receta } from './receta.entity.js';

/**
 * Tabla de asociación Receta <-> Producto con la cantidad necesaria.
 * No es un componente propio: vive adentro del módulo Receta porque
 * es el detalle de implementación de "qué productos necesita una receta".
 *
 * El campo `receta` usa el wrapper Relation<T> de TypeORM: Receta y
 * RecetaIngrediente se importan entre sí (import circular), y en ESM
 * el decorador de la propiedad evalúa el tipo de forma inmediata al
 * cargar el módulo. Relation<T> evita que TypeScript emita esa
 * referencia directa a la clase, que si no revienta en runtime
 * ("Cannot access 'Receta' before initialization").
 */
@Entity('receta_ingredientes')
export class RecetaIngrediente {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Receta, (receta) => receta.ingredientes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'receta_id' })
  receta!: Relation<Receta>;

  @ManyToOne(() => Producto, { eager: true })
  @JoinColumn({ name: 'producto_id' })
  producto!: Relation<Producto>;

  @Column('int')
  cantidad!: number;
}
