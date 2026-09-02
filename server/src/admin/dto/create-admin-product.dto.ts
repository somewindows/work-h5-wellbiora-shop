import { IsArray, IsHexColor, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator'

export class CreateAdminProductDto {
  /** 运营自填商品 ID：小写字母开头，仅小写字母/数字/中划线，需在库内唯一 */
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{0,31}$/)
  id!: string

  @IsString() @MinLength(1) @MaxLength(128) name!: string
  @IsString() @MinLength(1) @MaxLength(128) en!: string
  @IsInt() @Min(0) priceFen!: number
  @IsHexColor() theme!: string
  @IsHexColor() themeLight!: string
  @IsString() @MaxLength(255) cardImg!: string
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[]
  @IsString() @MinLength(1) @MaxLength(128) spec!: string
  @IsOptional() @IsString() @MaxLength(128) flavor?: string
  @IsString() @MinLength(1) ingredients!: string
  @IsString() @MinLength(1) @MaxLength(255) originCert!: string
  @IsOptional() @IsString() usage?: string
  @IsString() @MinLength(1) complianceText!: string
}
