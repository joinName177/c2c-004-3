import { computed, reactive, ref } from 'vue';
import { createSampleSnapshot } from '../core/sample-data';
import { generatePlans } from '../core/plan-service';
import { detectRisks } from '../core/risk-engine';
import {
  canContain,
  getContainerImpact,
  normalizeSnapshot,
  removeContainerShell,
  removeContainerWithContents,
} from '../core/container-structure';
import { validateContainer } from '../core/packing-engine';
import type { Container, PackingItem, PackingSnapshot, PlanMode, Suitcase } from '../core/models';
import type { PlannerRepository } from '../ports/planner-repository.port';
import type { PrintPort } from '../ports/print.port';

export interface PlannerDependencies { repository: PlannerRepository; printPort: PrintPort }
export type ContainerDeleteMode = 'shell' | 'contents';

export function usePlanner({ repository, printPort }: PlannerDependencies) {
  const loaded = repository.load();
  const state = reactive<PackingSnapshot>(normalizeSnapshot(loaded.value));
  const notice = ref(loaded.warning ?? '');
  const isStale = ref(false);
  const plans = ref(generatePlans(state.suitcase, state.items, state.containers));
  const currentPlan = computed(() => plans.value[state.selectedPlan]);
  const risks = computed(() => detectRisks(currentPlan.value, state.suitcase, state.items, state.containers));

  const save = () => repository.save(JSON.parse(JSON.stringify(state)) as PackingSnapshot);
  const markStale = () => { isStale.value = true; save(); };

  function regeneratePlans() {
    plans.value = generatePlans(state.suitcase, state.items, state.containers);
  }

  function commitStructure(message: string) {
    regeneratePlans();
    isStale.value = false;
    notice.value = message;
    save();
  }

  function addItem(item: PackingItem) {
    state.items.push({ ...item, kind: 'item', parentId: item.parentId ?? null });
    markStale();
  }
  function updateItem(id: string, patch: Partial<PackingItem>) {
    const index = state.items.findIndex((item) => item.id === id);
    if (index >= 0) state.items[index] = { ...state.items[index], ...patch, kind: 'item' } as PackingItem;
    markStale();
  }
  function moveItem(id: string, parentId: string | null) {
    const item = state.items.find((candidate) => candidate.id === id);
    if (!item || item.parentId === parentId) return;
    item.parentId = parentId;
    commitStructure(parentId ? `已将 ${item.name} 放入容器，各层摆放已重新计算` : `已将 ${item.name} 移出容器，可独立参加外层装箱`);
  }
  function removeItem(id: string) {
    const item = state.items.find((candidate) => candidate.id === id);
    state.items = state.items.filter((candidate) => candidate.id !== id);
    markStale();
    if (item) notice.value = '物品已删除';
  }

  function addContainer(container: Container) {
    const errors = validateContainer(container);
    if (errors.length) {
      notice.value = errors[0];
      return;
    }
    state.containers.push({ ...container, kind: 'container', parentId: container.parentId ?? null });
    markStale();
  }
  function updateContainer(id: string, patch: Partial<Container>) {
    const index = state.containers.findIndex((container) => container.id === id);
    if (index >= 0) state.containers[index] = { ...state.containers[index], ...patch, kind: 'container', category: '容器' } as Container;
    markStale();
  }
  function moveContainer(id: string, parentId: string | null) {
    if (!canContain(id, parentId, state.containers)) return;
    const container = state.containers.find((candidate) => candidate.id === id);
    if (!container || container.parentId === parentId) return;
    container.parentId = parentId;
    commitStructure(parentId ? `已移动 ${container.name}，内层与外层结果已保存` : `已移出 ${container.name}，各层结果已保存`);
  }
  function previewContainerRemoval(id: string) {
    return getContainerImpact(id, state.containers, state.items);
  }
  function removeContainer(id: string, mode: ContainerDeleteMode) {
    const container = state.containers.find((candidate) => candidate.id === id);
    if (!container) return;
    const next = mode === 'shell'
      ? removeContainerShell(id, state.containers, state.items)
      : removeContainerWithContents(id, state.containers, state.items);
    state.containers = next.containers;
    state.items = next.items;
    commitStructure(mode === 'shell' ? `已删除容器外壳，内部内容已保留到上一层` : `容器及其全部内容已删除`);
  }

  function updateSuitcase(patch: Partial<Suitcase>) { Object.assign(state.suitcase, patch); markStale(); }
  function regenerate() {
    regeneratePlans();
    isStale.value = false;
    notice.value = '三层方案已重新计算';
    save();
  }
  function selectPlan(mode: PlanMode) { state.selectedPlan = mode; save(); }
  function resetSample() {
    const sample = createSampleSnapshot();
    Object.assign(state, sample);
    regeneratePlans();
    isStale.value = false;
    notice.value = '已恢复登机箱示例';
    save();
  }

  return {
    state,
    notice,
    isStale,
    plans,
    currentPlan,
    risks,
    addItem,
    updateItem,
    moveItem,
    removeItem,
    addContainer,
    updateContainer,
    moveContainer,
    previewContainerRemoval,
    removeContainer,
    updateSuitcase,
    regenerate,
    selectPlan,
    resetSample,
    print: () => printPort.print(),
  };
}
