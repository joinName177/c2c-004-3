<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import type { Container, PackingItem } from '../../core/models';

const props = defineProps<{ containers?: Container[]; parentId?: string | null }>();
const emit = defineEmits<{ add: [item: PackingItem] }>();
const selectedParentId = ref<string | null>(props.parentId ?? null);
watch(() => props.parentId, (parentId) => { selectedParentId.value = parentId ?? null; });
const draft = reactive({
  name: '',
  category: '衣物',
  length: 20,
  width: 15,
  height: 5,
  weight: 0.3,
  priority: 2 as 1 | 2 | 3,
  mustHave: false,
  fragile: false,
});
function submit() {
  const name = draft.name.trim() || '未命名物品';
  emit('add', {
    ...draft,
    name,
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'item',
    parentId: selectedParentId.value,
  });
  draft.name = '';
}
</script>

<template>
  <form class="item-editor" data-testid="item-editor" @submit.prevent="submit">
    <input v-model="draft.name" aria-label="物品名称" placeholder="添加物品名称" />
    <select v-model="draft.category" aria-label="物品类别"><option>衣物</option><option>鞋履</option><option>数码</option><option>洗护</option><option>随身</option><option>其他</option></select>
    <select v-if="containers?.length" v-model="selectedParentId" aria-label="所属容器"><option :value="null">行李箱外层</option><option v-for="container in containers" :key="container.id" :value="container.id">{{ container.name }}</option></select>
    <label class="editor-options"><label>尺寸<input v-model.number="draft.length" type="number" min="0.1" step="0.1">×<input v-model.number="draft.width" type="number" min="0.1" step="0.1">×<input v-model.number="draft.height" type="number" min="0.1" step="0.1"></label><label>重量<input v-model.number="draft.weight" type="number" min="0.01" step="0.01"></label><label>P<select v-model="draft.priority" aria-label="优先级"><option :value="1">1</option><option :value="2">2</option><option :value="3">3</option></select></label><label><input v-model="draft.mustHave" type="checkbox">必带</label><label><input v-model="draft.fragile" type="checkbox">易碎</label></label>
    <button type="submit">＋ 添加</button>
  </form>
</template>
