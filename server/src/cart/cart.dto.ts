import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator'

export class AddCartItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string

  @IsInt()
  @Min(1)
  quantity!: number
}

export class UpdateCartItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number

  @IsOptional()
  @IsBoolean()
  checked?: boolean
}
