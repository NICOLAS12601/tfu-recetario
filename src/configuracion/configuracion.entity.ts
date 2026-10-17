import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Parámetro de configuración persistido (patrón External Configuration Store).
 * Se guarda como clave -> valor en texto; cada componente parsea lo que
 * necesita (todos los valores actuales son numéricos).
 */
@Entity('configuracion')
export class Configuracion {
  @PrimaryColumn()
  clave!: string;

  @Column()
  valor!: string;

  @UpdateDateColumn()
  actualizadoEn!: Date;
}
