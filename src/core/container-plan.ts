import { RESERVE, packIntoBox } from './packing-engine';
import { type Container, type ContainerPlan, type PackingItem, type PackingObject, type PackingPlan, type PlanMode, type Suitcase } from './models';

const PLAN_NAMES: Record<PlanMode, string> = { minimal: '精简版', comfort: '舒适版', shopping: '购物版' };

interface PlannedContainer extends ContainerPlan {
  childPlans: PlannedContainer[];
  pendingObjectCount: number;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function effectiveWeight(container: Container, plan: PackingPlan): number {
  return container.weight + plan.totalWeight;
}

function buildContainerPlan(
  container: Container,
  items: PackingItem[],
  containers: Container[],
  mode: PlanMode,
): PlannedContainer {
  const directItems = items.filter((item) => item.parentId === container.id);
  const childContainers = containers.filter((candidate) => candidate.parentId === container.id);
  const childPlans = childContainers.map((child) => buildContainerPlan(child, items, containers, mode));

  const candidates: PackingObject[] = [
    ...directItems.map((item) => ({ ...item, kind: 'item' as const })),
    ...childPlans.map((child) => ({
      ...child.container,
      weight: effectiveWeight(child.container, child.innerPlan),
      priority: child.effectivePriority,
      mustHave: child.effectiveMustHave,
    })),
  ];

  const innerPlan = packIntoBox(
    { length: container.innerLength, width: container.innerWidth, height: container.innerHeight },
    candidates,
    mode,
    1,
  );

  const placedIds = new Set(innerPlan.placements.map((placement) => placement.itemId));
  const placedChildPlans = childPlans.filter((plan) => placedIds.has(plan.container.id));
  const leafItemIds = unique([
    ...directItems.map((item) => item.id),
    ...childPlans.flatMap((plan) => plan.leafItemIds),
  ]);
  const loadedItemIds = unique([
    ...directItems.filter((item) => placedIds.has(item.id)).map((item) => item.id),
    ...placedChildPlans.flatMap((plan) => plan.loadedItemIds),
  ]);
  const effectiveMustHave = Boolean(container.mustHave)
    || directItems.some((item) => item.mustHave)
    || childPlans.some((plan) => plan.effectiveMustHave);
  const effectivePriority = Math.max(container.priority, ...childPlans.map((plan) => plan.effectivePriority)) as 1 | 2 | 3;
  const pendingObjectCount = innerPlan.unplaced.length
    + placedChildPlans.reduce((sum, plan) => sum + plan.pendingObjectCount, 0);

  return {
    container,
    innerPlan: {
      id: mode,
      name: PLAN_NAMES[mode],
      ...innerPlan,
      containerPlans: flattenContainerPlans(childPlans),
      loadedItemIds,
      pendingItemIds: leafItemIds.filter((id) => !loadedItemIds.includes(id)),
      pendingObjectCount,
    },
    packedWeight: container.weight + innerPlan.totalWeight,
    effectivePriority,
    effectiveMustHave,
    leafItemIds,
    loadedItemIds,
    pendingItemIds: leafItemIds.filter((id) => !loadedItemIds.includes(id)),
    pendingObjectCount,
    childPlans,
  };
}

function flattenContainerPlans(plans: PlannedContainer[]): ContainerPlan[] {
  return plans.flatMap(({ childPlans, ...plan }) => [plan, ...flattenContainerPlans(childPlans)]);
}

export function planHierarchy(
  suitcase: Suitcase,
  items: PackingItem[],
  containers: Container[],
  mode: PlanMode,
): PackingPlan {
  const topItems = items.filter((item) => !item.parentId);
  const topContainers = containers.filter((container) => !container.parentId);
  const topPlans = topContainers.map((container) => buildContainerPlan(container, items, containers, mode));

  const candidates: PackingObject[] = [
    ...topItems.map((item) => ({ ...item, kind: 'item' as const })),
    ...topPlans.map((plan) => ({
      ...plan.container,
      weight: plan.packedWeight,
      priority: plan.effectivePriority,
      mustHave: plan.effectiveMustHave,
    })),
  ];

  const result = packIntoBox(suitcase, candidates, mode, RESERVE[mode]);
  const placedIds = new Set(result.placements.map((placement) => placement.itemId));
  const placedTopContainers = topPlans.filter((plan) => placedIds.has(plan.container.id));
  const allContainerPlans = flattenContainerPlans(topPlans);
  const loadedItemIds = unique([
    ...topItems.filter((item) => placedIds.has(item.id)).map((item) => item.id),
    ...placedTopContainers.flatMap((plan) => plan.loadedItemIds),
  ]);
  const pendingItemIds = items.map((item) => item.id).filter((id) => !loadedItemIds.includes(id));
  const pendingObjectCount = result.unplaced.length
    + placedTopContainers.reduce((sum, plan) => sum + plan.innerPlan.pendingObjectCount, 0);

  return {
    id: mode,
    name: PLAN_NAMES[mode],
    ...result,
    containerPlans: allContainerPlans,
    loadedItemIds,
    pendingItemIds,
    pendingObjectCount,
  };
}

export function findContainerPlan(plan: PackingPlan, containerId: string | null | undefined): ContainerPlan | undefined {
  if (!containerId) return undefined;
  return plan.containerPlans.find((candidate) => candidate.container.id === containerId);
}

export function getActivePlan(plan: PackingPlan, containerId: string | null): PackingPlan {
  return findContainerPlan(plan, containerId)?.innerPlan ?? plan;
}
