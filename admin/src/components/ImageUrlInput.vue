<script setup lang="ts">
// 图片地址输入：缩略预览 + 「上传图片」按钮 + 保留手填输入框（存量路径/外链）。
// 上传走 request 实例（自动带 token、401 跳登录），FormData POST 到 /admin/uploads。
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

import { getErrorMessage } from '@/api/request'
import { uploadImage } from '@/api/uploads'

defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const uploading = ref(false)
const fileInputRef = ref<HTMLInputElement>()

function openFilePicker(): void {
  fileInputRef.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // 重置 value，保证连续选择同一文件也能触发 change
  input.value = ''
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过 5MB')
    return
  }
  uploading.value = true
  try {
    const result = await uploadImage(file)
    emit('update:modelValue', result.url)
    ElMessage.success('图片已上传')
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="image-url-input">
    <div class="preview-row">
      <el-image v-if="modelValue" :src="modelValue" fit="contain" class="thumb" :preview-src-list="[modelValue]" preview-teleported />
      <el-button :loading="uploading" @click="openFilePicker">上传图片</el-button>
      <input ref="fileInputRef" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="file-input" @change="onFileChange" />
    </div>
    <el-input :model-value="modelValue" placeholder="/assets/xxx.jpg 或点击上方按钮上传" maxlength="255" @update:model-value="emit('update:modelValue', $event)" />
  </div>
</template>

<style scoped>
.image-url-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.preview-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.thumb {
  width: 72px;
  height: 72px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #f5f7fa;
}

.file-input {
  display: none;
}
</style>
