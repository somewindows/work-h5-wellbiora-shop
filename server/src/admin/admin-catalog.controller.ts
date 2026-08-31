import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common'

import type { CatalogProductRecord } from '../catalog/catalog.repository'

import { AdminCatalogService } from './admin-catalog.service'
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard'
import { SaveDraftBlocksDto } from './dto/save-draft-blocks.dto'

@Controller('admin/products')
@UseGuards(AdminJwtAuthGuard)
export class AdminCatalogController {
  constructor(private readonly adminCatalogService: AdminCatalogService) {}

  @Get(':id')
  getProduct(@Param('id') id: string): Promise<CatalogProductRecord> {
    return this.adminCatalogService.getProduct(id)
  }

  @Put(':id/draft-blocks')
  saveDraftBlocks(@Param('id') id: string, @Body() dto: SaveDraftBlocksDto): Promise<CatalogProductRecord> {
    return this.adminCatalogService.saveDraftBlocks(id, dto.blocks)
  }

  @Post(':id/publish')
  @HttpCode(200)
  publishDraft(@Param('id') id: string): Promise<CatalogProductRecord> {
    return this.adminCatalogService.publishDraft(id)
  }
}
