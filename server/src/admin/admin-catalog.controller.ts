import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common'

import type { CatalogProductRecord } from '../catalog/catalog.repository'

import { AdminCatalogService } from './admin-catalog.service'
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard'
import { SaveDraftBlocksDto } from './dto/save-draft-blocks.dto'
import { CurrentAdmin } from './current-admin.decorator'
import type { AdminActor } from './audit-log.service'
import { AdminProductQueryDto } from './dto/admin-product-query.dto'
import { UpdateAdminProductDto } from './dto/update-admin-product.dto'

@Controller('admin/products')
@UseGuards(AdminJwtAuthGuard)
export class AdminCatalogController {
  constructor(private readonly adminCatalogService: AdminCatalogService) {}

  @Get()
  listProducts(@Query() query: AdminProductQueryDto): Promise<{ total: number; list: CatalogProductRecord[] }> {
    return this.adminCatalogService.listProducts(query)
  }

  @Get(':id')
  getProduct(@Param('id') id: string): Promise<CatalogProductRecord> {
    return this.adminCatalogService.getProduct(id)
  }

  @Patch(':id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateAdminProductDto, @CurrentAdmin() admin: AdminActor): Promise<CatalogProductRecord> {
    return this.adminCatalogService.updateProduct(id, dto, admin)
  }

  @Put(':id/draft-blocks')
  saveDraftBlocks(@Param('id') id: string, @Body() dto: SaveDraftBlocksDto): Promise<CatalogProductRecord> {
    return this.adminCatalogService.saveDraftBlocks(id, dto.blocks)
  }

  @Post(':id/publish')
  @HttpCode(200)
  publishDraft(@Param('id') id: string, @CurrentAdmin() admin: AdminActor): Promise<CatalogProductRecord> {
    return this.adminCatalogService.publishDraft(id, admin)
  }
}
