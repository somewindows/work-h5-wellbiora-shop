import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { CartItem } from '@/types'
import { addCartItem, getCart, removeCartItem, updateCartItem } from '@/api'

/** 购物车 store：数据以服务端（或 mock 层）为准，本地只做镜像 */
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  /** 购物车总件数（Tabbar 角标） */
  const totalCount = computed(() => items.value.reduce((s, i) => s + i.quantity, 0))

  /** 勾选商品的合计金额（分） */
  const checkedTotalFen = computed(() =>
    items.value.filter((i) => i.checked).reduce((s, i) => s + i.priceFen * i.quantity, 0),
  )

  const checkedItems = computed(() => items.value.filter((i) => i.checked))

  async function refresh() {
    items.value = await getCart()
  }

  async function add(productId: string, quantity = 1) {
    items.value = await addCartItem(productId, quantity)
  }

  async function update(id: string, patch: { quantity?: number; checked?: boolean }) {
    items.value = await updateCartItem(id, patch)
  }

  async function remove(id: string) {
    items.value = await removeCartItem(id)
  }

  return { items, totalCount, checkedTotalFen, checkedItems, refresh, add, update, remove }
})
