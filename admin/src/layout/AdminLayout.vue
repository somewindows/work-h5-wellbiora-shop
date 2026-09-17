<script setup lang="ts">
// 主布局：侧边菜单 + 顶栏（当前管理员下拉：修改密码/退出登录）
import { ArrowDown, Avatar, Document, Goods, Odometer, Tickets, User } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const activeMenu = computed(() => {
  // 详情页高亮所属列表菜单
  if (route.path.startsWith('/orders')) return '/orders'
  if (route.path.startsWith('/users')) return '/users'
  if (route.path.startsWith('/products')) return '/products'
  return route.path
})

const pageTitle = computed(() => (route.meta.title as string) ?? '')

// 顶栏管理员下拉菜单
function onAdminCommand(command: 'change-password' | 'logout'): void {
  if (command === 'change-password') {
    void router.push('/change-password')
    return
  }
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
        <el-menu-item index="/overview">
          <el-icon><Odometer /></el-icon>
          <span>数据概览</span>
        </el-menu-item>
        <el-menu-item index="/products">
          <el-icon><Goods /></el-icon>
          <span>商品管理</span>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><Tickets /></el-icon>
          <span>订单管理</span>
        </el-menu-item>
        <el-menu-item index="/users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
        <el-menu-item index="/audit-logs">
          <el-icon><Document /></el-icon>
          <span>操作日志</span>
        </el-menu-item>
        <!-- 账号管理仅超级管理员可见（服务端仍逐接口回查角色） -->
        <el-menu-item v-if="auth.isSuper" index="/accounts">
          <el-icon><Avatar /></el-icon>
          <span>管理员</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="page-title">{{ pageTitle }}</div>
        <div class="header-right">
          <el-dropdown trigger="click" @command="onAdminCommand">
            <span class="admin-name">
              {{ auth.username }}<el-icon class="admin-name-arrow"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="change-password">修改密码</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  outline: none;
}

.admin-name-arrow {
  font-size: 12px;
}

.main {
  padding: 16px;
}
</style>
