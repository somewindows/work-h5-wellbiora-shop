import { IsString, Length, Matches } from 'class-validator'

export class AdminLoginDto {
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-zA-Z0-9_.-]+$/)
  username!: string

  @IsString()
  @Length(12, 128)
  password!: string
}
