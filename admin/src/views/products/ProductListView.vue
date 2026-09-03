<script setup lang="ts">
// 商品管理列表页：关键字搜索、上下架筛选、分页、新建商品对话框
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'

import { createProduct, listProducts } from '@/api/products'
import { getErrorMessage } from '@/api/request'
import type { AdminProduct, CreateProductPayload } from '@/types'
import { formatDateTime, formatMoney, yuanToFen } from '@/utils/format'

const router = useRouter()

const loading = ref(false)
const list = ref<AdminProduct[]>([])
const total = ref(0)
const query = reactive({ keyword: '', isActive: '' as '' | 'true' | 'false', page: 1, pageSize: 20 })

async function fetchList(): Promise<void> {
  loading.value = true
  try {
    const result = await listProducts({
      keyword: query.keyword || undefined,
      isActive: query.isActive === '' ? undefined : query.isActive === 'true',
      page: query.page,
      pageSize: query.pageSize,
    })
    list.value = result.list
    total.value = result.total
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function onSearch(): void {
  query.page = 1
  void fetchList()
}

function onPageChange(page: number): void {
  query.page = page
  void fetchList()
}

// ---------- 新建商品对话框（字段与服务端 CreateAdminProductDto 一一对应） ----------
const createVisible = ref(false)
const creating = ref(false)
const createFormRef = ref<FormInstance>()
const createForm = reactive({
  id: '',
  name: '',
  en: '',
  priceYuan: 0,
  theme: '#033B3C',
  themeLight: '#D9EDE2',
  cardImg: '',
  tags: [] as string[],
  spec: '',
  flavor: '',
  ingredients: '',
  originCert: '',
  usage: '',
  complianceText: '',
})

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

const createRules: FormRules = {
  id: [
    { required: true, message: '请输入商品 ID', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9-]{0,31}$/, message: '小写字母开头，仅小写字母/数字/中划线，最长 32 位', trigger: 'blur' },
  ],
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  en: [{ required: true, message: '请输入英文名', trigger: 'blur' }],
  priceYuan: [{ required: true, type: 'number', min: 0, message: '价格不能为负', trigger: 'blur' }],
  theme: [
    { required: true, message: '请选择主题色', trigger: 'change' },
    { pattern: HEX_COLOR, message: '必须是 hex 颜色值', trigger: 'blur' },
  ],
  themeLight: [
    { required: true, message: '请选择浅色主题色', trigger: 'change' },
    { pattern: HEX_COLOR, message: '必须是 hex 颜色值', trigger: 'blur' },
  ],
  cardImg: [{ required: true, message: '请输入卡片图 URL', trigger: 'blur' }],
  spec: [{ required: true, message: '请输入产品规格', trigger: 'blur' }],
  ingredients: [{ required: true, message: '请输入核心成分', trigger: 'blur' }],
  originCert: [{ required: true, message: '请输入产地与认证', trigger: 'blur' }],
  complianceText: [{ required: true, message: '请输入合规声明文案', trigger: 'blur' }],
}

function openCreate(): void {
  createVisible.value = true
}

async function submitCreate(): Promise<void> {
  if (!createFormRef.value) return
  const valid = await createFormRef.value.validate().catch(() => false)
  if (!valid) return
  creating.value = true
  try {
    const payload: CreateProductPayload = {
      id: createForm.id.trim(),
      name: createForm.name.trim(),
      en: createForm.en.trim(),
      priceFen: yuanToFen(createForm.priceYuan),
      theme: createForm.theme,
      themeLight: createForm.themeLight,
      cardImg: createForm.cardImg.trim(),
      tags: createForm.tags,
      spec: createForm.spec.trim(),
      flavor: createForm.flavor.trim() || undefined,
      ingredients: createForm.ingredients.trim(),
      originCert: createForm.originCert.trim(),
      usage: createForm.usage.trim() || undefined,
      complianceText: createForm.complianceText.trim(),
    }
    const created = await createProduct(payload)
    ElMessage.success('商品已创建（默认下架状态，请编辑后上架）')
    createVisible.value = false
    await router.push(`/products/${created.id}`)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    creating.value = false
  }
}

onMounted(fetchList)
</script>

<template>
  <div class="page-card">
    <div class="toolbar">
      <el-input v-model="query.keyword" placeholder="搜索 ID / 名称 / 英文名" clearable style="width: 240px" @keyup.enter="onSearch" @clear="onSearch" />
      <el-select v-model="query.isActive" placeholder="上下架状态" style="width: 140px" @change="onSearch">
        <el-option label="全部" value="" />
        <el-option label="已上架" value="true" />
        <el-option label="已下架" value="false" />
      </el-select>
      <el-button type="primary" @click="onSearch">查询</el-button>
      <div class="spacer" />
      <el-button type="primary" @click="openCreate">新建商品</el-button>
    </div>

    <el-table v-loading="loading" :data="list" border>
      <el-table-column prop="id" label="ID" width="90" />
      <el-table-column prop="name" label="名称" min-width="160">
        <template #default="{ row }">
          <div>{{ row.name }}</div>
          <div class="en-name">{{ row.en }}</div>
        </template>
      </el-table-column>
      <el-table-column label="价格" width="110" align="right">
        <template #default="{ row }">{{ formatMoney(row.priceFen) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.isActive ? 'success' : 'info'">{{ row.isActive ? '已上架' : '已下架' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="contentVersion" label="内容版本" width="90" align="center" />
      <el-table-column label="goodsNo" width="120">
        <template #default="{ row }">{{ row.goodsNo ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="更新时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="router.push(`/products/${row.id}`)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      class="pager"
      layout="total, prev, pager, next"
      :total="total"
      :page-size="query.pageSize"
      :current-page="query.page"
      @current-change="onPageChange"
    />

    <!-- 新建商品对话框：complianceText 仅创建时可设置 -->
    <el-dialog v-model="createVisible" title="新建商品" width="640px" :close-on-click-modal="false">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="110px">
        <el-form-item label="商品 ID" prop="id">
          <el-input v-model="createForm.id" placeholder="如 p5（创建后不可修改）" />
        </el-form-item>
        <el-form-item label="商品名称" prop="name">
          <el-input v-model="createForm.name" maxlength="128" />
        </el-form-item>
        <el-form-item label="英文名" prop="en">
          <el-input v-model="createForm.en" maxlength="128" />
        </el-form-item>
        <el-form-item label="价格（元）" prop="priceYuan">
          <el-input-number v-model="createForm.priceYuan" :min="0" :precision="2" :step="1" style="width: 180px" />
        </el-form-item>
        <el-form-item label="主题色" prop="theme">
          <el-color-picker v-model="createForm.theme" />
          <el-input v-model="createForm.theme" class="color-input" maxlength="9" />
        </el-form-item>
        <el-form-item label="浅色主题色" prop="themeLight">
          <el-color-picker v-model="createForm.themeLight" />
          <el-input v-model="createForm.themeLight" class="color-input" maxlength="9" />
        </el-form-item>
        <el-form-item label="卡片图 URL" prop="cardImg">
          <el-input v-model="createForm.cardImg" placeholder="/assets/xxx.jpg" maxlength="255" />
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="createForm.tags" multiple filterable allow-create default-first-option placeholder="输入后回车创建标签" style="width: 100%" />
        </el-form-item>
        <el-form-item label="产品规格" prop="spec">
          <el-input v-model="createForm.spec" placeholder="如 5ml × 30袋 / 盒" maxlength="128" />
        </el-form-item>
        <el-form-item label="风味">
          <el-input v-model="createForm.flavor" maxlength="128" />
        </el-form-item>
        <el-form-item label="核心成分" prop="ingredients">
          <el-input v-model="createForm.ingredients" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="产地与认证" prop="originCert">
          <el-input v-model="createForm.originCert" maxlength="255" />
        </el-form-item>
        <el-form-item label="食用方法">
          <el-input v-model="createForm.usage" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="合规声明" prop="complianceText">
          <el-input v-model="createForm.complianceText" type="textarea" :rows="4" placeholder="详情页固定合规声明文案（仅创建时可设置）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.en-name {
  font-size: 12px;
  color: #909399;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}

.color-input {
  width: 120px;
  margin-left: 12px;
}
</style>
