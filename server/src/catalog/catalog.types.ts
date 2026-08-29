export interface Product {
  id: string
  name: string
  en: string
  priceFen: number
  theme: string
  themeLight: string
  cardImg: string
  tags: string[]
  spec: string
  flavor?: string
  ingredients: string
  originCert: string
  usage?: string
}

export interface ContentBlock {
  type: string
  [key: string]: unknown
}

export interface ProductDetail extends Product {
  blocks: ContentBlock[]
  complianceText: string
}
