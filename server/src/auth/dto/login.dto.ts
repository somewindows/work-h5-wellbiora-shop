import { Matches } from 'class-validator'

export class LoginDto {
  @Matches(/^1[3-9]\d{9}$/, { message: '请输入有效的中国大陆手机号' })
  phone!: string

  @Matches(/^\d{6}$/, { message: '验证码格式不正确' })
  code!: string
}
