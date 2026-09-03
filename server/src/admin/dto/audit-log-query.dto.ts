import { Transform } from 'class-transformer'
import { IsDate, IsOptional, IsString, Max, Min } from 'class-validator'

export class AuditLogQueryDto {
  @IsOptional() @IsString() action?: string
  @IsOptional() @Transform(({ value }) => new Date(value as string)) @IsDate() from?: Date
  @IsOptional() @Transform(({ value }) => new Date(value as string)) @IsDate() to?: Date
  @IsOptional() @Transform(({ value }) => Number(value)) @Min(1) page = 1
  @IsOptional() @Transform(({ value }) => Number(value)) @Min(1) @Max(100) pageSize = 20
}
