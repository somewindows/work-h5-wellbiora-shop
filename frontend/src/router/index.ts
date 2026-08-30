import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { getAuthRedirect } from './auth-guard'

// MVP 9 页路由（hash 模式，见 AGENTS.md 技术栈约定）
const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { title: '首页' } },
  { path: '/products', name: 'products', component: () => import('@/views/ProductsView.vue'), meta: { title: '全部产品' } },
  { path: '/product/:id', name: 'product', component: () => import('@/views/ProductDetailView.vue'), meta: { title: '商品详情' } },
  { path: '/cart', name: 'cart', component: () => import('@/views/CartView.vue'), meta: { title: '购物车' } },
  { path: '/checkout', name: 'checkout', component: () => import('@/views/CheckoutView.vue'), meta: { title: '结算', requiresAuth: true } },
  { path: '/address', name: 'address', component: () => import('@/views/AddressView.vue'), meta: { title: '地址与实名' } },
  { path: '/orders', name: 'orders', component: () => import('@/views/OrdersView.vue'), meta: { title: '我的订单', requiresAuth: true } },
  { path: '/order/:id', name: 'order', component: () => import('@/views/OrderDetailView.vue'), meta: { title: '订单详情', requiresAuth: true } },
  { path: '/mine', name: 'mine', component: () => import('@/views/MineView.vue'), meta: { title: '我的', requiresAuth: true } },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { title: '登录' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

/** 登录态与 Pinia 用户仓库共用 token 存储；登录成功后可跳回原页面。 */
router.beforeEach((to) => getAuthRedirect(to, Boolean(localStorage.getItem('token'))))

// 统一设置页面标题
router.afterEach((to) => {
  document.title = to.meta.title
    ? `${to.meta.title as string} - WELLBIORA 海外旗舰店`
    : 'WELLBIORA 海外旗舰店'
})

export default router
