import { IsArray, IsHexColor, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator'

/** 商品 ID 不再由运营填写，由服务端按 WB + 5 位递增数字自动生成 */
export class CreateAdminProductDto {
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
