<script setup lang="ts">
// 主布局：侧边菜单 + 顶栏（当前管理员、退出登录）
import { Document, Goods, Tickets } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const activeMenu = computed(() => {
  // 详情页高亮所属列表菜单
  if (route.path.startsWith('/orders')) return '/orders'
  if (route.path.startsWith('/products')) return '/products'
  return route.path
})

const pageTitle = computed(() => (route.meta.title as string) ?? '')

function onLogout(): void {
  auth.logout()
  void router.push('/login')
}
</script>

<template>
  <el-container class="admin-layout">
    <el-aside width="200px" class="aside">
      <div class="logo">
        <div class="logo-name">WELLBIORA™</div>
        <div class="logo-sub">运营后台</div>
      </div>
      <el-menu :default-active="activeMenu" router background-color="#033b3c" text-color="#b9d4d0" active-text-color="#ffffff">
        <el-menu-item index="/products">
          <el-icon><Goods /></el-icon>
          <span>商品管理</span>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><Tickets /></el-icon>
          <span>订单管理</span>
        </el-menu-item>
        <el-menu-item index="/audit-logs">
          <el-icon><Document /></el-icon>
          <span>操作日志</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="page-title">{{ pageTitle }}</div>
        <div class="header-right">
          <span class="admin-name">{{ auth.username }}</span>
          <el-button size="small" @click="onLogout">退出登录</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.admin-layout {
  height: 100dvh;
}

.aside {
  background-color: #033b3c;
}

.logo {
  padding: 20px 16px;
  color: #fff;
}

.logo-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.logo-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #b9d4d0;
}

.aside :deep(.el-menu) {
  border-right: none;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-name {
  font-size: 14px;
  color: #606266;
}

.main {
  padding: 16px;
}
</style>
