import { createRouter, createWebHistory } from 'vue-router'

import { isLoggedIn } from '@/utils/session'

const AdminLayout = () => import('@/layout/AdminLayout.vue')

export const router = createRouter({
  // BASE_URL 跟随 vite.config.ts 的 base（/admin/），保持两处基路径一致
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: AdminLayout,
      redirect: '/products',
      children: [
        { path: 'products', name: 'products', component: () => import('@/views/products/ProductListView.vue'), meta: { title: '商品管理' } },
        { path: 'products/:id', name: 'product-edit', component: () => import('@/views/products/ProductEditView.vue'), meta: { title: '商品编辑' } },
        { path: 'orders', name: 'orders', component: () => import('@/views/orders/OrderListView.vue'), meta: { title: '订单管理' } },
        { path: 'orders/:orderNo', name: 'order-detail', component: () => import('@/views/orders/OrderDetailView.vue'), meta: { title: '订单详情' } },
        { path: 'audit-logs', name: 'audit-logs', component: () => import('@/views/AuditLogView.vue'), meta: { title: '操作日志' } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/products' },
  ],
})

// 路由守卫：未登录一律跳 /login；已登录访问 /login 跳首页
router.beforeEach((to) => {
  if (to.meta.public) {
    return isLoggedIn() ? { path: '/products' } : true
  }
  if (!isLoggedIn()) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  return true
})
