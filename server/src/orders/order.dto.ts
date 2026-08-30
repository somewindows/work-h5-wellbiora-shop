import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  requestId!: string
}

export class OrdersQueryDto {
  @IsOptional()
  @IsString()
  status?: string
}
