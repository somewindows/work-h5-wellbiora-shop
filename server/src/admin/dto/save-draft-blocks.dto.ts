import { IsArray } from 'class-validator'

import type { ContentBlock } from '../../catalog/catalog.types'

export class SaveDraftBlocksDto {
  @IsArray()
  blocks!: ContentBlock[]
}
