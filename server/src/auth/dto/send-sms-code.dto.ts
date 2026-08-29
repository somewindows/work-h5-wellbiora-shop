import { Matches } from 'class-validator'

export class SendSmsCodeDto {
  @Matches(/^1[3-9]\d{9}$/, { message: '请输入有效的中国大陆手机号' })
  phone!: string
}
