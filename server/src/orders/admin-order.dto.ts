import { Transform } from 'class-transformer'
import { IsBoolean, IsDate, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class AdminOrderQueryDto {
  @IsOptional() @IsIn(['pay', 'ship', 'receive', 'complete', 'cancelled']) status?: string
  /** 订单号或收货手机号模糊匹配 */
  @IsOptional() @IsString() keyword?: string
  @IsOptional() @Transform(({ value }) => new Date(value as string)) @IsDate() from?: Date
  @IsOptional() @Transform(({ value }) => new Date(value as string)) @IsDate() to?: Date
  @IsOptional() @Transform(({ value }) => Number(value)) @Min(1) page = 1
  @IsOptional() @Transform(({ value }) => Number(value)) @Min(1) @Max(100) pageSize = 20
}

export class AdminOrderConfirmDto {
  /** 二次确认：缺省或非 true 一律由业务层拒绝（40003） */
  @IsOptional() @IsBoolean()
  confirm?: boolean
}

export class AdminOrderRefundDto extends AdminOrderConfirmDto {
  /** 缺省按实付全额退款；不得超过实付金额 */
  @IsOptional() @IsInt() @Min(1) amountFen?: number
}
