<script setup lang="ts">
// 商品编辑页：基础信息表单（保存即生效）+ 内容块编辑 Tab
// 注意：complianceText 仅创建时可设置，这里只读展示；id 不可修改
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'

import { getProduct, updateProduct } from '@/api/products'
import { getErrorMessage } from '@/api/request'
import BlockEditor from '@/components/blocks/BlockEditor.vue'
import type { AdminProduct, UpdateProductPayload } from '@/types'
import { fenToYuan, yuanToFen } from '@/utils/format'

const route = useRoute()
const productId = route.params.id as string

const loading = ref(false)
const saving = ref(false)
const activeTab = ref('basic')
const product = ref<AdminProduct | null>(null)
const formRef = ref<FormInstance>()

const form = reactive({
  name: '',
  en: '',
  priceYuan: 0,
  theme: '',
  themeLight: '',
  cardImg: '',
  tags: [] as string[],
  spec: '',
  flavor: '',
  ingredients: '',
  originCert: '',
  usage: '',
  goodsNo: '',
  warehouseCode: '',
  isActive: false,
})

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

const rules: FormRules = {
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
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const detail = await getProduct(productId)
    product.value = detail
    Object.assign(form, {
      name: detail.name,
      en: detail.en,
      priceYuan: Number(fenToYuan(detail.priceFen)),
      theme: detail.theme,
      themeLight: detail.themeLight,
      cardImg: detail.cardImg,
      tags: [...detail.tags],
      spec: detail.spec,
      flavor: detail.flavor ?? '',
      ingredients: detail.ingredients,
      originCert: detail.originCert,
      usage: detail.usage ?? '',
      goodsNo: detail.goodsNo ?? '',
      warehouseCode: detail.warehouseCode ?? '',
      isActive: detail.isActive,
    })
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function onSave(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    const payload: UpdateProductPayload = {
      name: form.name.trim(),
      en: form.en.trim(),
      priceFen: yuanToFen(form.priceYuan),
      theme: form.theme,
      themeLight: form.themeLight,
      cardImg: form.cardImg.trim(),
      tags: form.tags,
      spec: form.spec.trim(),
      flavor: form.flavor,
      ingredients: form.ingredients.trim(),
      originCert: form.originCert.trim(),
      usage: form.usage,
      goodsNo: form.goodsNo,
      warehouseCode: form.warehouseCode,
      isActive: form.isActive,
    }
    product.value = await updateProduct(productId, payload)
    ElMessage.success('已保存（基础信息即时生效，已记操作日志）')
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="page-card">
    <div class="edit-head">
      <el-button link @click="$router.back()">← 返回列表</el-button>
      <span class="product-id">商品 ID：{{ productId }}</span>
      <el-tag v-if="product" :type="product.isActive ? 'success' : 'info'">{{ product.isActive ? '已上架' : '已下架' }}</el-tag>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="基础信息" name="basic">
        <el-form ref="formRef" :model="form" :rules="rules" label-width="110px" class="basic-form">
          <el-form-item label="商品名称" prop="name">
            <el-input v-model="form.name" maxlength="128" />
          </el-form-item>
          <el-form-item label="英文名" prop="en">
            <el-input v-model="form.en" maxlength="128" />
          </el-form-item>
          <el-form-item label="价格（元）" prop="priceYuan">
            <el-input-number v-model="form.priceYuan" :min="0" :precision="2" :step="1" style="width: 180px" />
            <span class="form-tip">价格改动即时生效；结算中的订单以预检快照价为准</span>
          </el-form-item>
          <el-form-item label="主题色" prop="theme">
            <el-color-picker v-model="form.theme" />
            <el-input v-model="form.theme" class="color-input" maxlength="9" />
          </el-form-item>
          <el-form-item label="浅色主题色" prop="themeLight">
            <el-color-picker v-model="form.themeLight" />
            <el-input v-model="form.themeLight" class="color-input" maxlength="9" />
          </el-form-item>
          <el-form-item label="卡片图 URL" prop="cardImg">
            <el-input v-model="form.cardImg" maxlength="255" />
          </el-form-item>
          <el-form-item label="标签">
            <el-select v-model="form.tags" multiple filterable allow-create default-first-option placeholder="输入后回车创建标签" style="width: 100%" />
          </el-form-item>
          <el-form-item label="产品规格" prop="spec">
            <el-input v-model="form.spec" maxlength="128" />
          </el-form-item>
          <el-form-item label="风味">
            <el-input v-model="form.flavor" maxlength="128" />
          </el-form-item>
          <el-form-item label="核心成分" prop="ingredients">
            <el-input v-model="form.ingredients" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="产地与认证" prop="originCert">
            <el-input v-model="form.originCert" maxlength="255" />
          </el-form-item>
          <el-form-item label="食用方法">
            <el-input v-model="form.usage" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="仓库 goods_no">
            <el-input v-model="form.goodsNo" maxlength="64" placeholder="关联君梦仓库商品编码" />
          </el-form-item>
          <el-form-item label="仓库编码">
            <el-input v-model="form.warehouseCode" maxlength="64" placeholder="如义乌保税仓编码" />
          </el-form-item>
          <el-form-item label="上下架">
            <el-switch v-model="form.isActive" active-text="上架" inactive-text="下架" />
          </el-form-item>
          <el-form-item label="合规声明">
            <el-input :model-value="product?.complianceText ?? ''" type="textarea" :rows="4" readonly disabled />
            <span class="form-tip">仅创建时可设置；如需修改请联系开发走数据变更流程</span>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="saving" @click="onSave">保存基础信息</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
      <el-tab-pane label="内容块编辑" name="blocks" lazy>
        <BlockEditor :product-id="productId" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.edit-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.product-id {
  font-size: 13px;
  color: #606266;
}

.basic-form {
  max-width: 720px;
}

.form-tip {
  margin-left: 12px;
  font-size: 12px;
  color: #909399;
}

.color-input {
  width: 120px;
  margin-left: 12px;
}
</style>
