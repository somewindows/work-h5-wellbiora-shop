import { IsArray, IsBoolean, IsHexColor, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class UpdateAdminProductDto {
  @IsOptional() @IsString() @MaxLength(128) name?: string
  @IsOptional() @IsString() @MaxLength(128) en?: string
  @IsOptional() @IsInt() @Min(0) priceFen?: number
  @IsOptional() @IsHexColor() theme?: string
  @IsOptional() @IsHexColor() themeLight?: string
  @IsOptional() @IsString() @MaxLength(255) cardImg?: string
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[]
  @IsOptional() @IsString() @MaxLength(128) spec?: string
  @IsOptional() @IsString() @MaxLength(128) flavor?: string
  @IsOptional() @IsString() ingredients?: string
  @IsOptional() @IsString() @MaxLength(255) originCert?: string
  @IsOptional() @IsString() usage?: string
  @IsOptional() @IsString() @MaxLength(64) goodsNo?: string
  @IsOptional() @IsString() @MaxLength(64) warehouseCode?: string
  @IsOptional() @IsBoolean() isActive?: boolean
}
