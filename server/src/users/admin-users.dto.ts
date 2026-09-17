import { Transform } from 'class-transformer'
import { IsBoolean, IsDate, IsOptional, IsString, Max, Min } from 'class-validator'

export class AdminUserQueryDto {
  /** 手机号模糊匹配 */
  @IsOptional() @IsString() keyword?: string
  @IsOptional() @Transform(({ value }) => new Date(value as string)) @IsDate() from?: Date
  @IsOptional() @Transform(({ value }) => new Date(value as string)) @IsDate() to?: Date
  @IsOptional() @Transform(({ value }) => Number(value)) @Min(1) page = 1
  @IsOptional() @Transform(({ value }) => Number(value)) @Min(1) @Max(100) pageSize = 20
}

export class AdminUserConfirmDto {
  /** 二次确认：缺省或非 true 一律由业务层拒绝（40003） */
  @IsOptional() @IsBoolean()
  confirm?: boolean
}
