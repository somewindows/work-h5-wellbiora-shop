import { DynamicModule, Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { isInMemoryStorage } from '../common/runtime-mode'

import { CatalogBootstrapService } from './catalog-bootstrap.service'
import { CatalogProductEntity } from './catalog-product.entity'
import { CATALOG_REPOSITORY, InMemoryCatalogRepository, TypeOrmCatalogRepository } from './catalog.repository'

@Global()
@Module({})
export class CatalogModule {
  static register(): DynamicModule {
    const isTest = isInMemoryStorage()
    return {
      global: true,
      module: CatalogModule,
      imports: isTest ? [] : [TypeOrmModule.forFeature([CatalogProductEntity])],
      providers: [
        CatalogBootstrapService,
        { provide: CATALOG_REPOSITORY, useClass: isTest ? InMemoryCatalogRepository : TypeOrmCatalogRepository },
      ],
      exports: [CATALOG_REPOSITORY],
    }
  }
}
