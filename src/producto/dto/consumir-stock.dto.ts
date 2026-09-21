import { IsInt, Min } from 'class-validator';

export class ConsumirStockDto {
  @IsInt()
  @Min(1)
  cantidad!: number;
}
