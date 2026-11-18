import { IsBoolean, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePlanDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Le prix doit être un nombre valide.' })
  @Min(0, { message: 'Le prix doit être supérieur ou égal à 0.' })
  price!: number;

  @IsBoolean({ message: 'Le champ active doit être un booléen.' })
  active!: boolean;
}
