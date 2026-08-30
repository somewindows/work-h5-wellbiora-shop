import { Inject, Injectable } from '@nestjs/common'

import { BusinessException } from '../common/business.exception'
import { PersonalDataCryptoService } from '../security/personal-data-crypto.service'

import type { CreateAddressDto, SaveRealnameDto, UpdateAddressDto } from './profile.dto'
import {
  ADDRESS_REPOSITORY,
  REALNAME_PROFILE_REPOSITORY,
  type AddressRecord,
  type AddressRepository,
  type RealnameProfileRecord,
  type RealnameProfileRepository,
} from './profile.repository'

export interface RealnameResponse {
  name: string
  idcard: string
}

@Injectable()
export class ProfileService {
  constructor(
    @Inject(ADDRESS_REPOSITORY) private readonly addressRepository: AddressRepository,
    @Inject(REALNAME_PROFILE_REPOSITORY) private readonly realnameRepository: RealnameProfileRepository,
    private readonly crypto: PersonalDataCryptoService,
  ) {}

  getAddresses(userId: string): Promise<AddressRecord[]> {
    return this.addressRepository.findByUser(userId)
  }

  async getAddress(userId: string, id: string): Promise<AddressRecord> {
    const address = await this.addressRepository.findByIdAndUser(id, userId)
    if (!address) throw new BusinessException(40404, '收货地址不存在', 404)
    return address
  }

  async createAddress(userId: string, dto: CreateAddressDto): Promise<AddressRecord> {
    const existing = await this.addressRepository.findByUser(userId)
    const isDefault = dto.isDefault ?? existing.length === 0
    if (isDefault) await this.addressRepository.clearDefault(userId)
    return this.addressRepository.save(this.addressRepository.create({
      userId,
      name: dto.name.trim(),
      phone: dto.phone,
      region: dto.region.trim(),
      detail: dto.detail.trim(),
      isDefault,
    }))
  }

  async updateAddress(userId: string, id: string, dto: UpdateAddressDto): Promise<AddressRecord> {
    const address = await this.getAddress(userId, id)
    if (dto.isDefault) await this.addressRepository.clearDefault(userId)
    return this.addressRepository.save({
      ...address,
      ...dto,
      name: dto.name?.trim() ?? address.name,
      region: dto.region?.trim() ?? address.region,
      detail: dto.detail?.trim() ?? address.detail,
    })
  }

  async removeAddress(userId: string, id: string): Promise<null> {
    const address = await this.getAddress(userId, id)
    await this.addressRepository.remove(address)
    return null
  }

  async getRealname(userId: string): Promise<RealnameResponse | null> {
    const profile = await this.realnameRepository.findByUser(userId)
    return profile ? this.toRealnameResponse(profile) : null
  }

  async getRealnameForOrder(userId: string): Promise<RealnameProfileRecord> {
    const profile = await this.realnameRepository.findByUser(userId)
    if (!profile) throw new BusinessException(40002, '请先完成实名认证')
    return profile
  }

  async saveRealname(userId: string, dto: SaveRealnameDto): Promise<RealnameResponse> {
    if (!/^\d{17}[\dXx]$/.test(dto.idcard)) throw new BusinessException(40002, '身份证号格式不正确')
    const existing = await this.realnameRepository.findByUser(userId)
    const profile = existing
      ? {
          ...existing,
          name: dto.name.trim(),
          idcardEncrypted: this.crypto.encrypt(dto.idcard.toUpperCase()),
          idcardFingerprint: this.crypto.fingerprint(dto.idcard.toUpperCase()),
        }
      : this.realnameRepository.create({
          userId,
          name: dto.name.trim(),
          idcardEncrypted: this.crypto.encrypt(dto.idcard.toUpperCase()),
          idcardFingerprint: this.crypto.fingerprint(dto.idcard.toUpperCase()),
        })
    return this.toRealnameResponse(await this.realnameRepository.save(profile))
  }

  private toRealnameResponse(profile: RealnameProfileRecord): RealnameResponse {
    const idcard = this.crypto.decrypt(profile.idcardEncrypted)
    return { name: profile.name, idcard: `${idcard.slice(0, 3)}***********${idcard.slice(-4)}` }
  }
}
