import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator'

/** 修改自己的登录密码：旧密码校验 + 新密码至少 12 位（下限由业务层判定为 40003，DTO 只约束非空与上限） */
export class AdminChangePasswordDto {
  @IsString()
  @Length(1, 128)
  oldPassword!: string

  @IsString()
  @Length(1, 128)
  newPassword!: string
}

/** 新建管理员：用户名规则与登录 DTO 一致；confirm:true 只能由二次确认触发 */
export class CreateAdminAccountDto {
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-zA-Z0-9_.-]+$/)
  username!: string

  @IsOptional() @IsBoolean()
  confirm?: boolean
}

/** 禁用/启用/重置密码的二次确认（缺省或非 true 由业务层 40003 拒绝） */
export class AdminAccountConfirmDto {
  @IsOptional() @IsBoolean()
  confirm?: boolean
}
