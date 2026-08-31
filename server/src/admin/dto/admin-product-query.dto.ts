import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional, IsString, Max, Min } from 'class-validator'

export class AdminProductQueryDto {
  @IsOptional() @IsString() keyword?: string
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() isActive?: boolean
  @IsOptional() @Transform(({ value }) => Number(value)) @Min(1) page = 1
  @IsOptional() @Transform(({ value }) => Number(value)) @Min(1) @Max(100) pageSize = 20
}
