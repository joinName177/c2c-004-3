import { computed, reactive, ref } from 'vue';
import { createSampleSnapshot } from '../core/sample-data';
import {
  createEntityGraph,
  descendantIds,
  generateHierarchicalPlans,
  normalizeSnapshot,
  wouldCreateCycle,
} from '../core/nested-packing';
import { detectHierarchyRisks } from '../core/hierarchy-risk';
import type { HierarchicalPlan, PackingEntity, PackingSnapshot, PlanMode, Suitcase } from '../core/models';
import type { PlannerRepository } from '../ports/planner-repository.port';
import type { PrintPort } from '../ports/print.port';

export interface PlannerDependencies { repository: PlannerRepository; printPort: PrintPort }
export interface ContainerImpact { entity: PackingEntity; descendants: PackingEntity[]; targetContainerId?: string | null }

export function usePlanner({ repository, printPort }: PlannerDependencies) {
  const loaded = repository.load();
  const state = reactive<PackingSnapshot>(normalizeSnapshot(loaded.value, createSampleSnapshot())) as PackingSnapshot;
  state.plans = (loaded.value as PackingSnapshot).plans ?? generateHierarchicalPlans(state);
  const notice = ref(loaded.warning ?? '');
  const isStale = ref(false);
  const plans = ref<Record<PlanMode, HierarchicalPlan>>(state.plans);
  const currentPlan = computed(() => plans.value[state.selectedPlan]);
  const risks = computed(() => detectHierarchyRisks(state.suitcase, state.items, currentPlan.value));

  const save = () => {
    state.plans = plans.value;
    repository.save(JSON.parse(JSON.stringify(state)) as PackingSnapshot);
  };
  const markStale = () => { isStale.value = true; save(); };
  const graph = () => createEntityGraph(state.items);
  const findEntity = (id: string) => state.items.find((item) => item.id === id);

  function addItem(item: PackingEntity) {
    state.items.push(item);
    markStale();
  }
  function updateItem(id: string, patch: Partial<PackingEntity>) {
    const index = state.items.findIndex((item) => item.id === id);
    if (index >= 0) state.items[index] = { ...state.items[index], ...patch } as PackingEntity;
    markStale();
  }
  function removeItem(id: string) {
    state.items = state.items.filter((item) => item.id !== id);
    for (const item of state.items) if (item.containerId === id) item.containerId = null;
    regenerate('物品及各层摆放结果已更新');
  }
  function updateSuitcase(patch: Partial<Suitcase>) { Object.assign(state.suitcase, patch); markStale(); }

  function containerImpact(id: string, targetContainerId: string | null): ContainerImpact | null {
    const entity = findEntity(id);
    if (!entity || entity.kind !== 'container') return null;
    const currentGraph = graph();
    const descendants = descendantIds(currentGraph, id)
      .map((descendantId) => findEntity(descendantId))
      .filter((item): item is PackingEntity => Boolean(item));
    return { entity, descendants, targetContainerId };
  }
  function canMove(id: string, targetContainerId: string | null): boolean {
    const currentGraph = graph();
    if (targetContainerId !== null && !currentGraph.entities.has(targetContainerId)) return false;
    return !wouldCreateCycle(currentGraph, id, targetContainerId);
  }

  function moveEntity(id: string, targetContainerId: string | null) {
    if (!canMove(id, targetContainerId)) return false;
    const entity = findEntity(id);
    if (!entity) return false;
    entity.containerId = targetContainerId;
    // Moving a container is an explicit ownership change; recalculate and keep
    // every layer together instead of presenting a partially stale container.
    regenerate(`已将 ${entity.name} ${targetContainerId ? `移入 ${findEntity(targetContainerId)?.name ?? '容器'}` : '移出到行李箱'}`);
    return true;
  }

  function removeContainer(id: string) {
    const entity = findEntity(id);
    if (!entity) return false;
    state.items = state.items.filter((item) => item.id !== id);
    for (const item of state.items) if (item.containerId === id) item.containerId = null;
    regenerate('容器已删除，其中内容已保留为独立物品');
    return true;
  }

  function regenerate(message = '三套方案与各层容器结果已重新计算') {
    plans.value = generateHierarchicalPlans(state);
    state.plans = plans.value;
    isStale.value = false;
    notice.value = message;
    save();
  }
  function selectPlan(mode: PlanMode) { state.selectedPlan = mode; save(); }
  function resetSample() {
    const sample = createSampleSnapshot();
    Object.assign(state, sample);
    plans.value = generateHierarchicalPlans(state);
    state.plans = plans.value;
    isStale.value = false;
    notice.value = '已恢复登机箱示例';
    save();
  }

  return {
    state, notice, isStale, plans, currentPlan, risks,
    addItem, updateItem, removeItem, removeContainer, moveEntity, canMove, containerImpact,
    updateSuitcase, regenerate: () => regenerate(), selectPlan, resetSample,
    print: () => printPort.print(),
  };
}
