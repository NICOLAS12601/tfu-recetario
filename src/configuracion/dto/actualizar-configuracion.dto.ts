import { IsNotEmpty, IsString } from 'class-validator';

export class ActualizarConfiguracionDto {
  @IsString()
  @IsNotEmpty()
  valor!: string;
}
