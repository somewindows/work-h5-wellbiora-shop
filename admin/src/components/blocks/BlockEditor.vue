<script setup lang="ts">
// 内容块编辑器（MVP 形态：可排序卡片列表 + 按 type 出表单 + JSON 预览，不做可视化拖拽）
// 草稿/发布双态：保存草稿走 PUT draft-blocks，发布/回滚均二次确认
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import BlockForm from '@/components/blocks/BlockForm.vue'
import { getProduct, listProducts, publishProduct, rollbackProduct, saveDraftBlocks } from '@/api/products'
import { getErrorMessage } from '@/api/request'
import type { AdminProduct, ContentBlock } from '@/types'
import { blocksEqual, blockTypeLabel, createBlockTemplate, KNOWN_BLOCK_TYPES } from '@/utils/block'

const props = defineProps<{ productId: string }>()

const loading = ref(false)
const saving = ref(false)
const publishing = ref(false)
const rollingBack = ref(false)
const product = ref<AdminProduct | null>(null)
/** 本地编辑中的草稿（与服务端 draftBlocks 分离，保存草稿才落库） */
const draft = ref<ContentBlock[]>([])
const selectedIndex = ref(-1)
const addType = ref('')
const jsonDrawerVisible = ref(false)
const productOptions = ref<{ id: string; name: string }[]>([])

const selectedBlock = computed(() => (selectedIndex.value >= 0 ? draft.value[selectedIndex.value] : null))

/** 草稿与线上是否有差异（顶部状态条展示） */
const hasDraftDiff = computed(() => (product.value ? !blocksEqual(draft.value, product.value.blocks) : false))
/** 本地有未保存到草稿库的修改 */
const hasLocalChanges = computed(() => (product.value ? !blocksEqual(draft.value, product.value.draftBlocks) : false))

const draftJsonPreview = computed(() => JSON.stringify(draft.value, null, 2))

async function load(): Promise<void> {
  loading.value = true
  try {
    const [detail, options] = await Promise.all([
      getProduct(props.productId),
      listProducts({ page: 1, pageSize: 100 }),
    ])
    product.value = detail
    draft.value = structuredClone(detail.draftBlocks)
    productOptions.value = options.list.map((item) => ({ id: item.id, name: item.name }))
    selectedIndex.value = draft.value.length > 0 ? 0 : -1
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function applyProduct(next: AdminProduct): void {
  product.value = next
  draft.value = structuredClone(next.draftBlocks)
  if (selectedIndex.value >= draft.value.length) selectedIndex.value = draft.value.length - 1
}

// ---------- 块列表操作：上移/下移/禁用/删除/添加 ----------
function moveBlock(index: number, offset: -1 | 1): void {
  const target = index + offset
  if (target < 0 || target >= draft.value.length) return
  const [block] = draft.value.splice(index, 1)
  draft.value.splice(target, 0, block)
  selectedIndex.value = target
}

function toggleHidden(block: ContentBlock): void {
  // hidden:true 比删除安全（线上渲染会跳过）；恢复时移除字段而非置 false，保持数据干净
  if (block.hidden === true) delete block.hidden
  else block.hidden = true
}

async function removeBlock(index: number): Promise<void> {
  try {
    await ElMessageBox.confirm('确定删除该内容块吗？删除后需「保存草稿」才生效，发布前不影响线上。', '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  draft.value.splice(index, 1)
  if (selectedIndex.value === index) selectedIndex.value = Math.min(index, draft.value.length - 1)
  else if (selectedIndex.value > index) selectedIndex.value -= 1
}

function addBlock(): void {
  if (!addType.value) return
  draft.value.push(createBlockTemplate(addType.value))
  selectedIndex.value = draft.value.length - 1
  addType.value = ''
}

// ---------- 草稿 / 发布 / 回滚 ----------
async function onSaveDraft(): Promise<void> {
  saving.value = true
  try {
    applyProduct(await saveDraftBlocks(props.productId, draft.value))
    ElMessage.success('草稿已保存')
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function onPublish(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      hasLocalChanges.value
        ? '本地有未保存的修改，发布会以服务端已保存的草稿为准。建议先保存草稿。确认发布当前草稿到线上吗？'
        : '发布将用草稿整体覆盖线上内容并生成新版本号。确认发布吗？',
      '发布确认',
      { type: 'warning', confirmButtonText: '发布', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  publishing.value = true
  try {
    applyProduct(await publishProduct(props.productId))
    ElMessage.success('发布成功')
  } catch (error) {
    // 服务端校验失败（缺必填 / 带 * 宣称无脚注等）原样展示
    ElMessageBox.alert(getErrorMessage(error), '发布失败', { type: 'error', confirmButtonText: '知道了' })
  } finally {
    publishing.value = false
  }
}

async function onRollback(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '回滚会用上一发布版本覆盖当前线上内容与草稿，当前线上内容将丢失。确认回滚吗？',
      '回滚上一版',
      { type: 'error', confirmButtonText: '确认回滚', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  rollingBack.value = true
  try {
    applyProduct(await rollbackProduct(props.productId))
    ElMessage.success('已回滚到上一版')
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    rollingBack.value = false
  }
}

/** 块卡片摘要：挑一个有代表性的字段展示 */
function blockSummary(block: ContentBlock): string {
  const candidate = block.title ?? block.src ?? block.text ?? block.kick ?? block.body
  if (typeof candidate === 'string' && candidate) return candidate.length > 30 ? `${candidate.slice(0, 30)}…` : candidate
  if (Array.isArray(block.images)) return `${block.images.length} 张图`
  if (Array.isArray(block.items)) return `${block.items.length} 项`
  if (Array.isArray(block.productIds)) return `${block.productIds.length} 个商品`
  return '-'
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="block-editor">
    <!-- 顶部状态条：版本号 / 差异提示 / 操作按钮 -->
    <div class="status-bar">
      <el-tag>线上版本 v{{ product?.contentVersion ?? '-' }}</el-tag>
      <el-tag v-if="hasDraftDiff" type="warning">草稿与线上有差异</el-tag>
      <el-tag v-else type="success">草稿与线上一致</el-tag>
      <el-tag v-if="hasLocalChanges" type="danger">有未保存的修改</el-tag>
      <div class="spacer" />
      <el-button size="small" @click="jsonDrawerVisible = true">JSON 预览</el-button>
      <el-button size="small" type="primary" :loading="saving" :disabled="!hasLocalChanges" @click="onSaveDraft">保存草稿</el-button>
      <el-button size="small" type="success" :loading="publishing" @click="onPublish">发布</el-button>
      <el-button size="small" type="danger" plain :loading="rollingBack" @click="onRollback">回滚上一版</el-button>
    </div>

    <!-- 添加块 -->
    <div class="add-bar">
      <el-select v-model="addType" placeholder="选择块类型" size="small" style="width: 220px">
        <el-option v-for="type in KNOWN_BLOCK_TYPES" :key="type" :label="`${blockTypeLabel(type)}（${type}）`" :value="type" />
      </el-select>
      <el-button size="small" type="primary" :disabled="!addType" @click="addBlock">添加块</el-button>
      <span class="add-hint">合规声明块由系统固定注入，不出现在编辑器中</span>
    </div>

    <div class="editor-body">
      <!-- 左：草稿块卡片列表（可排序/禁用/删除） -->
      <div class="block-list">
        <el-empty v-if="draft.length === 0" description="暂无内容块，先在上方添加" :image-size="80" />
        <div
          v-for="(block, index) in draft"
          :key="index"
          class="block-card"
          :class="{ selected: index === selectedIndex, hidden: block.hidden === true }"
          @click="selectedIndex = index"
        >
          <div class="block-card-head">
            <span class="block-order">{{ index + 1 }}</span>
            <span class="block-type">{{ blockTypeLabel(block.type) }}</span>
            <el-tag v-if="block.hidden === true" size="small" type="info">已禁用</el-tag>
          </div>
          <div class="block-summary">{{ blockSummary(block) }}</div>
          <div class="block-actions" @click.stop>
            <el-button link size="small" :disabled="index === 0" @click="moveBlock(index, -1)">上移</el-button>
            <el-button link size="small" :disabled="index === draft.length - 1" @click="moveBlock(index, 1)">下移</el-button>
            <el-button link size="small" @click="toggleHidden(block)">{{ block.hidden === true ? '启用' : '禁用' }}</el-button>
            <el-button link size="small" type="danger" @click="removeBlock(index)">删除</el-button>
          </div>
        </div>
      </div>

      <!-- 右：选中块表单 -->
      <div class="block-panel">
        <el-empty v-if="!selectedBlock" description="选择左侧块进行编辑" :image-size="80" />
        <BlockForm v-else :key="selectedIndex" :block="selectedBlock" :product-options="productOptions" />
      </div>
    </div>

    <!-- JSON 预览抽屉（只读） -->
    <el-drawer v-model="jsonDrawerVisible" title="草稿 JSON 预览（只读）" size="50%">
      <pre class="json-view">{{ draftJsonPreview }}</pre>
    </el-drawer>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.status-bar .spacer {
  flex: 1;
}

.add-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.add-hint {
  font-size: 12px;
  color: #909399;
}

.editor-body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.block-list {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100dvh - 320px);
  overflow: auto;
}

.block-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  background: #fff;
}

.block-card.selected {
  border-color: #033b3c;
  box-shadow: 0 0 0 1px #033b3c inset;
}

.block-card.hidden {
  opacity: 0.55;
}

.block-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.block-order {
  font-size: 12px;
  color: #909399;
}

.block-type {
  font-size: 13px;
  font-weight: 600;
}

.block-summary {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.block-actions {
  margin-top: 4px;
}

.block-panel {
  flex: 1;
  min-width: 0;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
}
</style>
