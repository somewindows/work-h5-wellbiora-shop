import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator'

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  name!: string

  @Matches(/^1[3-9]\d{9}$/)
  phone!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  region!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  detail!: string

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean
}

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  name?: string

  @IsOptional()
  @Matches(/^1[3-9]\d{9}$/)
  phone?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  region?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  detail?: string

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean
}

export class SaveRealnameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(18)
  @ValidateIf((dto: SaveRealnameDto) => Boolean(dto.idcard?.trim()))
  @Matches(/^\d{17}[\dXx]$/)
  idcard?: string
}
