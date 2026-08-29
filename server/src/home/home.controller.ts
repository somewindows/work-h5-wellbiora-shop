import { Controller, Get } from '@nestjs/common'

import { HOME_BLOCKS } from '../catalog/catalog.seed'
import type { ContentBlock } from '../catalog/catalog.types'

@Controller('home')
export class HomeController {
  @Get()
  findHome(): ContentBlock[] {
    return HOME_BLOCKS
  }
}
