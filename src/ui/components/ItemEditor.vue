<script setup lang="ts">
import { reactive, ref } from 'vue';
import type { PackingEntity } from '../../core/models';

const emit = defineEmits<{ add: [item: PackingEntity] }>();
const kind = ref<'item' | 'container'>('item');
const draft = reactive({
  name: '', category: '衣物', length: 20, width: 15, height: 5,
  innerLength: 18, innerWidth: 13, innerHeight: 3,
  weight: 0.3, priority: 2 as 1|2|3, mustHave: false, fragile: false,
});
const errors = ref<string[]>([]);

function changeKind(value: 'item' | 'container') {
  kind.value = value;
  draft.category = value === 'container' ? '收纳' : '衣物';
  if (value === 'container') {
    draft.innerLength = Math.max(1, draft.length - 2);
    draft.innerWidth = Math.max(1, draft.width - 2);
    draft.innerHeight = Math.max(1, draft.height - 2);
  }
}

function validate(): string[] {
  const result: string[] = [];
  const outer = [draft.length, draft.width, draft.height, draft.weight];
  if (outer.some((value) => !(value > 0))) result.push('外尺寸和自重必须大于 0');
  if (kind.value === 'container' && [draft.innerLength, draft.innerWidth, draft.innerHeight].some((value) => !(value > 0))) {
    result.push('容器内尺寸必须大于 0');
  }
  if (kind.value === 'container' && (
    draft.innerLength > draft.length || draft.innerWidth > draft.width || draft.innerHeight > draft.height
  )) result.push('容器内尺寸不能大于对应外尺寸');
  return result;
}

function submit() {
  errors.value = validate();
  if (errors.value.length) return;
  const name = draft.name.trim() || (kind.value === 'container' ? '未命名容器' : '未命名物品');
  const id = `${kind.value}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const base = {
    id, name, category: draft.category,
    length: draft.length, width: draft.width, height: draft.height,
    weight: draft.weight, priority: draft.priority,
    mustHave: draft.mustHave, fragile: draft.fragile, containerId: null,
  };
  emit('add', kind.value === 'container'
    ? { ...base, kind: 'container', innerLength: draft.innerLength, innerWidth: draft.innerWidth, innerHeight: draft.innerHeight }
    : { ...base, kind: 'item' });
  draft.name = '';
}
</script>

<template>
  <form class="item-editor entity-editor" data-testid="item-editor" @submit.prevent="submit">
    <div class="editor-kind">
      <button type="button" :class="{ active: kind === 'item' }" @click="changeKind('item')">小物件</button>
      <button type="button" :class="{ active: kind === 'container' }" @click="changeKind('container')">容器</button>
    </div>
    <input v-model="draft.name" :aria-label="kind === 'container' ? '容器名称' : '物品名称'" :placeholder="kind === 'container' ? '添加相机包/收纳盒' : '添加物品名称'" />
    <select v-model="draft.category" aria-label="物品类别"><option>衣物</option><option>鞋履</option><option>数码</option><option>洗护</option><option>随身</option><option>收纳</option><option>数码收纳</option><option>预留</option><option>其他</option></select>
    <div class="measure-grid">
      <label>外长<input v-model.number="draft.length" aria-label="外长或物品长度" type="number" min="1" /></label>
      <label>外宽<input v-model.number="draft.width" aria-label="外宽或物品宽度" type="number" min="1" /></label>
      <label>外高<input v-model.number="draft.height" aria-label="外高或物品高度" type="number" min="1" /></label>
      <template v-if="kind === 'container'">
        <label>内长<input v-model.number="draft.innerLength" aria-label="容器内长" type="number" min="1" /></label>
        <label>内宽<input v-model.number="draft.innerWidth" aria-label="容器内宽" type="number" min="1" /></label>
        <label>内高<input v-model.number="draft.innerHeight" aria-label="容器内高" type="number" min="1" /></label>
      </template>
    </div>
    <div class="editor-options">
      <label>自重 kg<input v-model.number="draft.weight" aria-label="自重或物品重量" type="number" min="0.1" step="0.01" /></label>
      <label>优先级<select v-model.number="draft.priority" aria-label="优先级"><option :value="3">P3</option><option :value="2">P2</option><option :value="1">P1</option></select></label>
      <label class="check"><input v-model="draft.mustHave" type="checkbox" /> 必带</label>
      <label class="check"><input v-model="draft.fragile" type="checkbox" /> 易碎</label>
    </div>
    <p v-for="error in errors" :key="error" class="field-error">{{ error }}</p>
    <button type="submit" class="add-button">＋ 添加{{ kind === 'container' ? '容器' : '物品' }}</button>
  </form>
</template>
