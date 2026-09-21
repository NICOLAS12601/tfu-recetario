import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class IngredienteDto {
  @IsUUID()
  productoId!: string;

  @IsInt()
  @Min(1)
  cantidad!: number;
}

export class CreateRecetaDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ValidateNested({ each: true })
  @Type(() => IngredienteDto)
  @ArrayMinSize(1)
  ingredientes!: IngredienteDto[];
}
