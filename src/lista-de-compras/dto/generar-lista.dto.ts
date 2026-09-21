import { ArrayMinSize, IsUUID } from 'class-validator';

export class GenerarListaDto {
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  recetaIds!: string[];
}
