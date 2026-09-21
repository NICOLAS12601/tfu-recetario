import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { RecetaIngrediente } from './receta-ingrediente.entity.js';

@Entity('recetas')
export class Receta {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  nombre!: string;

  @OneToMany(() => RecetaIngrediente, (ri) => ri.receta, {
    cascade: true,
    eager: true,
  })
  ingredientes!: Relation<RecetaIngrediente[]>;
}
