<script setup lang="ts">
import { reactive } from 'vue';
import type { Container } from '../../core/models';

const props = defineProps<{ parentId?: string | null }>();
const emit = defineEmits<{ add: [container: Container] }>();
const draft = reactive({
  name: '',
  length: 20,
  width: 15,
  height: 10,
  innerLength: 18,
  innerWidth: 13,
  innerHeight: 8,
  weight: 0.2,
  priority: 2 as 1 | 2 | 3,
  mustHave: false,
});

function submit() {
  const name = draft.name.trim() || '未命名容器';
  emit('add', {
    ...draft,
    name,
    id: `container-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: '容器',
    kind: 'container',
    parentId: props.parentId ?? null,
  });
  draft.name = '';
}
</script>

<template>
  <form class="container-editor" data-testid="container-editor" @submit.prevent="submit">
    <input v-model="draft.name" aria-label="容器名称" placeholder="相机包 / 收纳盒名称" />
    <div class="dimension-line">
      <label>外尺寸 <input v-model.number="draft.length" aria-label="容器外部长度" type="number" min="1" step="0.1"> × <input v-model.number="draft.width" aria-label="容器外部宽度" type="number" min="1" step="0.1"> × <input v-model.number="draft.height" aria-label="容器外部高度" type="number" min="1" step="0.1"></label>
      <label>内尺寸 <input v-model.number="draft.innerLength" aria-label="容器内部长度" type="number" min="1" step="0.1"> × <input v-model.number="draft.innerWidth" aria-label="容器内部宽度" type="number" min="1" step="0.1"> × <input v-model.number="draft.innerHeight" aria-label="容器内部高度" type="number" min="1" step="0.1"></label>
      <label>自重 <input v-model.number="draft.weight" aria-label="容器自重" type="number" min="0" step="0.01"> kg</label>
      <label class="check-line"><input v-model="draft.mustHave" type="checkbox"> 容器或其内容为必带</label>
    </div>
    <button type="submit">＋ 添加容器</button>
  </form>
</template>
