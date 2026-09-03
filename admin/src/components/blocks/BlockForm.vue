<script setup lang="ts">
// 单个内容块的表单：按 type 查 BLOCK_SCHEMAS 渲染通用控件；nutrition 用专用表格编辑器；
// 未知 type 兜底为原始 JSON 编辑（带校验，不崩溃）
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import type { ContentBlock } from '@/types'
import { blockTypeLabel } from '@/utils/block'
import { BLOCK_SCHEMAS, type BlockField } from './blockSchemas'

interface ProductOption {
  id: string
  name: string
}

const props = defineProps<{
  block: ContentBlock
  /** product_rail / product_grid 的商品选项 */
  productOptions: ProductOption[]
}>()

const schema = computed<BlockField[] | undefined>(() => BLOCK_SCHEMAS[props.block.type])
const isNutrition = computed(() => props.block.type === 'nutrition')

// ---------- 字段读写辅助（就地修改响应式 block，父组件持有同一份引用） ----------
function getString(key: string): string {
  const value = props.block[key]
  return typeof value === 'string' ? value : ''
}

function setString(key: string, value: string): void {
  props.block[key] = value
}

function getStringArray(key: string): string[] {
  const value = props.block[key]
  if (!Array.isArray(value)) {
    const next: string[] = []
    props.block[key] = next
    return next
  }
  return value as string[]
}

function getObjectArray<T extends object>(key: string): T[] {
  const value = props.block[key]
  if (!Array.isArray(value)) {
    const next: T[] = []
    props.block[key] = next
    return next
  }
  return value as T[]
}

function getProductIds(key: string): string[] {
  return getStringArray(key)
}

function addStringItem(key: string): void {
  getStringArray(key).push('')
}

function removeStringItem(key: string, index: number): void {
  getStringArray(key).splice(index, 1)
}

interface StatsItem {
  n: string
  unit: string
  l: string
  d: string
}

interface IconLabelItem {
  icon: string
  label: string
}

function addStatsItem(key: string): void {
  getObjectArray<StatsItem>(key).push({ n: '', unit: '', l: '', d: '' })
}

function addIconLabelItem(key: string): void {
  getObjectArray<IconLabelItem>(key).push({ icon: '', label: '' })
}

function removeObjectItem(key: string, index: number): void {
  getObjectArray<never>(key).splice(index, 1)
}

// ---------- nutrition 专用编辑器：head 为列定义，rows 为 string[][] ----------
function getNutritionHead(): string[] {
  return getStringArray('head')
}

function getNutritionRows(): string[][] {
  const value = props.block.rows
  if (!Array.isArray(value)) {
    const next: string[][] = []
    props.block.rows = next
    return next
  }
  return value as string[][]
}

function addNutritionColumn(): void {
  getNutritionHead().push('')
  for (const row of getNutritionRows()) row.push('')
}

function removeNutritionColumn(index: number): void {
  getNutritionHead().splice(index, 1)
  for (const row of getNutritionRows()) row.splice(index, 1)
}

function addNutritionRow(): void {
  getNutritionRows().push(getNutritionHead().map(() => ''))
}

function removeNutritionRow(index: number): void {
  getNutritionRows().splice(index, 1)
}

// ---------- 未知 type：原始 JSON 编辑（防御，不崩溃） ----------
const rawJson = ref('')
const rawJsonError = ref('')

watch(
  () => props.block,
  (block) => {
    if (!schema.value && !isNutrition.value) rawJson.value = JSON.stringify(block, null, 2)
  },
  { immediate: true },
)

function applyRawJson(): void {
  rawJsonError.value = ''
  try {
    const parsed = JSON.parse(rawJson.value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || typeof (parsed as { type?: unknown }).type !== 'string') {
      rawJsonError.value = '必须是含字符串 type 字段的对象'
      return
    }
    // 就地替换字段，保持父组件里的对象引用不变
    for (const key of Object.keys(props.block)) delete props.block[key]
    Object.assign(props.block, parsed)
    ElMessage.success('JSON 已应用')
  } catch (error) {
    rawJsonError.value = `JSON 语法错误：${error instanceof Error ? error.message : String(error)}`
  }
}
</script>

<template>
  <div class="block-form">
    <!-- 已知 type（非 nutrition）：按 schema 渲染通用控件 -->
    <template v-if="schema">
      <div v-for="field in schema" :key="field.key" class="field">
        <div class="field-label">
          <span v-if="field.required" class="required">*</span>
          {{ field.label }}
        </div>

        <el-input v-if="field.kind === 'string'" :model-value="getString(field.key)" @update:model-value="setString(field.key, $event)" />

        <el-input v-else-if="field.kind === 'textarea'" :model-value="getString(field.key)" type="textarea" :rows="3" @update:model-value="setString(field.key, $event)" />

        <div v-else-if="field.kind === 'stringArray'" class="row-list">
          <div v-for="(_item, index) in getStringArray(field.key)" :key="index" class="row-item">
            <el-input v-model="getStringArray(field.key)[index]" />
            <el-button link type="danger" @click="removeStringItem(field.key, index)">删除</el-button>
          </div>
          <el-button size="small" @click="addStringItem(field.key)">+ 添加一行</el-button>
        </div>

        <div v-else-if="field.kind === 'statsItems'" class="row-list">
          <div v-for="(item, index) in getObjectArray<StatsItem>(field.key)" :key="index" class="stats-row">
            <el-input v-model="item.n" placeholder="数字 n" style="width: 90px" />
            <el-input v-model="item.unit" placeholder="单位 unit" style="width: 80px" />
            <el-input v-model="item.l" placeholder="说明 l" style="flex: 1" />
            <el-input v-model="item.d" placeholder="英文 d" style="flex: 1" />
            <el-button link type="danger" @click="removeObjectItem(field.key, index)">删除</el-button>
          </div>
          <el-button size="small" @click="addStatsItem(field.key)">+ 添加数据项</el-button>
        </div>

        <div v-else-if="field.kind === 'iconLabelItems'" class="row-list">
          <div v-for="(item, index) in getObjectArray<IconLabelItem>(field.key)" :key="index" class="stats-row">
            <el-input v-model="item.icon" placeholder="图标 key（icon）" style="flex: 1" />
            <el-input v-model="item.label" placeholder="文案（label）" style="flex: 1" />
            <el-button link type="danger" @click="removeObjectItem(field.key, index)">删除</el-button>
          </div>
          <el-button size="small" @click="addIconLabelItem(field.key)">+ 添加图标项</el-button>
        </div>

        <el-select
          v-else-if="field.kind === 'productIds'"
          :model-value="getProductIds(field.key)"
          multiple
          placeholder="选择商品"
          style="width: 100%"
          @update:model-value="(value: string[]) => (block[field.key] = value)"
        >
          <el-option v-for="option in productOptions" :key="option.id" :label="`${option.id} · ${option.name}`" :value="option.id" />
        </el-select>

        <el-alert v-if="field.compliance" type="warning" show-icon :closable="false" class="field-hint" title="合规必填：带 * 宣称必须填写脚注来源" />
        <div v-else-if="field.hint" class="field-hint text">{{ field.hint }}</div>
      </div>
    </template>

    <!-- nutrition：专用表格编辑器 -->
    <template v-else-if="isNutrition">
      <div class="field">
        <div class="field-label"><span class="required">*</span>标题</div>
        <el-input :model-value="getString('title')" @update:model-value="setString('title', $event)" />
      </div>
      <div class="field">
        <div class="field-label"><span class="required">*</span>说明（meta）</div>
        <el-input :model-value="getString('meta')" placeholder="如：每份食用量：5毫升（1袋）｜每盒份数：30" @update:model-value="setString('meta', $event)" />
      </div>
      <div class="field">
        <div class="field-label">
          <span class="required">*</span>表格（表头 + 行）
          <el-button size="small" class="col-add" @click="addNutritionColumn">+ 添加列</el-button>
        </div>
        <el-table :data="getNutritionRows()" border size="small" class="nutrition-table">
          <el-table-column v-for="(_head, colIndex) in getNutritionHead()" :key="colIndex">
            <template #header>
              <div class="head-cell">
                <el-input v-model="getNutritionHead()[colIndex]" size="small" placeholder="表头" />
                <el-button link type="danger" size="small" @click="removeNutritionColumn(colIndex)">删列</el-button>
              </div>
            </template>
            <template #default="{ $index }">
              <el-input v-model="getNutritionRows()[$index][colIndex]" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70" align="center">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="removeNutritionRow($index)">删行</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-button size="small" class="row-add" @click="addNutritionRow">+ 添加行</el-button>
      </div>
      <div class="field">
        <div class="field-label"><span class="required">*</span>说明脚注（note）</div>
        <el-input :model-value="getString('note')" type="textarea" :rows="3" placeholder="如：† 营养素参考值（NRV）未制定。" @update:model-value="setString('note', $event)" />
      </div>
    </template>

    <!-- 未知 type：原始 JSON 兜底编辑 -->
    <template v-else>
      <el-alert
        type="info"
        show-icon
        :closable="false"
        :title="`「${blockTypeLabel(block.type)}」暂无表单，直接编辑原始 JSON`"
        class="field"
      />
      <el-input v-model="rawJson" type="textarea" :rows="14" spellcheck="false" class="raw-json" />
      <el-alert v-if="rawJsonError" type="error" show-icon :closable="false" :title="rawJsonError" class="field" />
      <el-button type="primary" size="small" class="field" @click="applyRawJson">校验并应用</el-button>
    </template>
  </div>
</template>

<style scoped>
.field {
  margin-bottom: 16px;
}

.field-label {
  margin-bottom: 6px;
  font-size: 13px;
  color: #606266;
}

.required {
  color: #e6432d;
  margin-right: 2px;
}

.field-hint {
  margin-top: 6px;
}

.field-hint.text {
  font-size: 12px;
  color: #909399;
}

.row-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.row-item {
  display: flex;
  gap: 8px;
  width: 100%;
}

.row-item :deep(.el-input) {
  flex: 1;
}

.stats-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.col-add {
  margin-left: 12px;
}

.row-add {
  margin-top: 8px;
}

.nutrition-table {
  width: 100%;
}

.head-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}

.raw-json {
  width: 100%;
  font-family: Consolas, monospace;
}
</style>
