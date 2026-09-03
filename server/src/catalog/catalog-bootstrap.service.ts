import { Inject, Injectable, OnModuleInit } from '@nestjs/common'

import { PRODUCT_DETAILS } from './catalog.seed'
import { CATALOG_REPOSITORY, type CatalogRepository } from './catalog.repository'

@Injectable()
export class CatalogBootstrapService implements OnModuleInit {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly repository: CatalogRepository) {}

  async onModuleInit(): Promise<void> {
    if (await this.repository.count()) return
    await this.repository.seed(Object.values(PRODUCT_DETAILS))
  }
}
