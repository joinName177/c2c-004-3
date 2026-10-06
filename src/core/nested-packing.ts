import { packItems } from './packing-engine';
import {
  innerDimensions,
  isContainer,
  type Container,
  type ContainerPlan,
  type HierarchicalPlan,
  type PackingEntity,
  type PackingItem,
  type PackingPlan,
  type PackingSnapshot,
  type PackingSpace,
  type PlanMode,
} from './models';

const UNLIMITED_WEIGHT = Number.MAX_SAFE_INTEGER;

export interface EntityGraph {
  entities: Map<string, PackingEntity>;
  children: Map<string | null, PackingEntity[]>;
}

function entityIdSort(a: PackingEntity, b: PackingEntity) {
  return a.id.localeCompare(b.id);
}

export function normalizeEntities(source: unknown): PackingEntity[] {
  if (!Array.isArray(source)) return [];
  const entities = source.map((value): PackingEntity | null => {
    if (!value || typeof value !== 'object' || !('id' in value) || !('name' in value)) return null;
    const record = value as Partial<PackingEntity>;
    const base: PackingItem = {
      id: String(record.id),
      name: String(record.name ?? '未命名'),
      category: String(record.category ?? '其他'),
      length: Number(record.length),
      width: Number(record.width),
      height: Number(record.height),
      weight: Number(record.weight),
      priority: (Number(record.priority) || 2) as 1 | 2 | 3,
      mustHave: Boolean(record.mustHave),
      fragile: Boolean(record.fragile),
      containerId: record.containerId ?? null,
    };
    if (record.kind === 'container') {
      return {
        ...base,
        kind: 'container',
        innerLength: Number(record.innerLength ?? record.length),
        innerWidth: Number(record.innerWidth ?? record.width),
        innerHeight: Number(record.innerHeight ?? record.height),
      };
    }
    return { ...base, kind: 'item' };
  }).filter((entity): entity is PackingEntity => entity !== null);

  // Remove parent references to missing entities or cycles. Each cycle member can
  // always be recovered by following parents; it is promoted back to the root.
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const originalParent = new Map(entities.map((entity) => [entity.id, entity.containerId ?? null]));
  for (const entity of entities) {
    let parentId = originalParent.get(entity.id) ?? null;
    const seen = new Set<string>();
    while (parentId) {
      if (parentId === entity.id || seen.has(parentId) || !byId.has(parentId)) {
        entity.containerId = null;
        break;
      }
      seen.add(parentId);
      parentId = originalParent.get(parentId) ?? null;
    }
  }
  return entities;
}

export function normalizeSnapshot(source: Partial<PackingSnapshot> | null | undefined, fallback: PackingSnapshot): PackingSnapshot {
  const rawItems = Array.isArray(source?.items) ? source!.items : fallback.items;
  const items = normalizeEntities(rawItems);
  const selectedPlan = source?.selectedPlan === 'minimal' || source?.selectedPlan === 'shopping' ? source.selectedPlan : fallback.selectedPlan;
  const suitcase = source?.suitcase ?? fallback.suitcase;
  return {
    suitcase: {
      length: Number(suitcase.length) || fallback.suitcase.length,
      width: Number(suitcase.width) || fallback.suitcase.width,
      height: Number(suitcase.height) || fallback.suitcase.height,
      maxWeight: Number(suitcase.maxWeight) || fallback.suitcase.maxWeight,
    },
    items,
    selectedPlan,
  };
}

export function createEntityGraph(entities: PackingEntity[]): EntityGraph {
  const map = new Map(entities.map((entity) => [entity.id, entity]));
  const children = new Map<string | null, PackingEntity[]>();
  for (const entity of entities) {
    const requestedParent = entity.containerId ?? null;
    const parentId = requestedParent && map.has(requestedParent) ? requestedParent : null;
    entity.containerId = parentId;
    const list = children.get(parentId) ?? [];
    list.push(entity);
    children.set(parentId, list);
  }
  for (const list of children.values()) list.sort(entityIdSort);
  return { entities: map, children };
}

export function getChildren(graph: EntityGraph, containerId: string | null): PackingEntity[] {
  return graph.children.get(containerId) ?? [];
}

export function descendantIds(graph: EntityGraph, containerId: string): string[] {
  const result: string[] = [];
  const visit = (id: string) => {
    for (const child of getChildren(graph, id)) {
      result.push(child.id);
      if (isContainer(child)) visit(child.id);
    }
  };
  visit(containerId);
  return result;
}

export function wouldCreateCycle(graph: EntityGraph, entityId: string, targetContainerId: string | null): boolean {
  if (targetContainerId === null) return false;
  if (targetContainerId === entityId) return true;
  if (descendantIds(graph, entityId).includes(targetContainerId)) return true;
  let parentId: string | null = targetContainerId;
  while (parentId) {
    if (parentId === entityId) return true;
    parentId = graph.entities.get(parentId)?.containerId ?? null;
  }
  return false;
}

function maxPriority(entities: PackingEntity[]): 1 | 2 | 3 {
  const value = Math.max(...entities.map((entity) => entity.priority)) as 1 | 2 | 3;
  return value || 2;
}

function subtreeHasMustHave(graph: EntityGraph, entityId: string): boolean {
  const entity = graph.entities.get(entityId);
  if (!entity) return false;
  if (entity.mustHave) return true;
  return getChildren(graph, entityId).some((child) => subtreeHasMustHave(graph, child.id));
}

export function effectiveMustHave(graph: EntityGraph, entity: PackingEntity): boolean {
  return entity.mustHave || (isContainer(entity) && subtreeHasMustHave(graph, entity.id));
}

function effectiveEntity(graph: EntityGraph, entity: PackingEntity, loadedWeights: Map<string, number>): PackingEntity {
  if (!isContainer(entity)) return entity;
  const descendants = descendantIds(graph, entity.id)
    .map((id) => graph.entities.get(id))
    .filter((child): child is PackingEntity => Boolean(child));
  const mustHave = effectiveMustHave(graph, entity);
  const priority = maxPriority([entity, ...descendants]);
  return { ...entity, weight: loadedWeights.get(entity.id) ?? entity.weight, mustHave, priority };
}

function containerSpace(container: Container): PackingSpace {
  return {
    ...innerDimensions(container),
    maxWeight: UNLIMITED_WEIGHT,
  };
}

function buildPlan(space: PackingSpace, units: PackingEntity[], mode: PlanMode, useFullSpace = false): PackingPlan {
  return packItems(space, units, mode, useFullSpace ? 1 : undefined);
}

export function generateHierarchicalPlan(snapshot: Pick<PackingSnapshot, 'suitcase' | 'items'>, mode: PlanMode): HierarchicalPlan {
  const graph = createEntityGraph(snapshot.items.map((entity) => ({ ...entity })));
  const containerPlans = new Map<string, ContainerPlan>();
  const loadedWeights = new Map<string, number>();
  const visiting = new Set<string>();

  function buildContainer(container: PackingEntity & { kind: 'container' }): PackingPlan {
    if (visiting.has(container.id)) throw new Error(`容器嵌套循环：${container.id}`);
    visiting.add(container.id);
    const childUnits = getChildren(graph, container.id).map((child) => {
      if (isContainer(child)) loadedWeights.set(child.id, buildContainer(child).totalWeight);
      return effectiveEntity(graph, child, loadedWeights);
    });
    const plan = buildPlan(containerSpace(container), childUnits, mode, true);
    const placedIds = new Set(plan.placements.map((placement) => placement.itemId));
    const loadedWeight = container.weight + childUnits.reduce((sum, child) => sum + (placedIds.has(child.id) ? child.weight : 0), 0);
    loadedWeights.set(container.id, loadedWeight);
    const planWithWeight: PackingPlan = { ...plan, totalWeight: loadedWeight };
    containerPlans.set(container.id, { containerId: container.id, containerName: container.name, plan: planWithWeight });
    visiting.delete(container.id);
    return planWithWeight;
  }

  // Containers can exist even if they are unplaced at an ancestor level. Their
  // contents still need deterministic coordinates for the drill-down view.
  for (const entity of snapshot.items) {
    if (isContainer(entity)) buildContainer(entity);
  }

  const rootUnits = getChildren(graph, null).map((entity) => effectiveEntity(graph, entity, loadedWeights));
  const root = buildPlan(snapshot.suitcase, rootUnits, mode);
  const containerPlanRecord: Record<string, ContainerPlan> = {};
  for (const [id, value] of containerPlans) containerPlanRecord[id] = value;
  return { ...root, containerPlans: containerPlanRecord };
}

export function generateHierarchicalPlans(snapshot: Pick<PackingSnapshot, 'suitcase' | 'items'>): Record<PlanMode, HierarchicalPlan> {
  return {
    minimal: generateHierarchicalPlan(snapshot, 'minimal'),
    comfort: generateHierarchicalPlan(snapshot, 'comfort'),
    shopping: generateHierarchicalPlan(snapshot, 'shopping'),
  };
}

export function getPlanForPath(hierarchical: HierarchicalPlan, path: string[], entities: PackingEntity[]): PackingPlan {
  const graph = createEntityGraph(entities.map((entity) => ({ ...entity})));
  let current: PackingPlan = hierarchical;
  for (const id of path) {
    const entity = graph.entities.get(id);
    if (!entity || !isContainer(entity)) break;
    current = hierarchical.containerPlans[id]?.plan ?? current;
  }
  return current;
}

export function isEntityPlaced(hierarchical: HierarchicalPlan, entityId: string, parentContainerId: string | null): boolean {
  const plan = parentContainerId ? hierarchical.containerPlans[parentContainerId]?.plan : hierarchical;
  return Boolean(plan?.placements.some((placement) => placement.itemId === entityId));
}

export function pendingReason(hierarchical: HierarchicalPlan, entityId: string, parentContainerId: string | null): string | undefined {
  const plan = parentContainerId ? hierarchical.containerPlans[parentContainerId]?.plan : hierarchical;
  return plan?.unplaced.find(({ item }) => item.id === entityId)?.reason;
}

export interface EntityTravelState {
  placed: boolean;
  reason: string;
  blockingContainerId?: string;
}

export function travelState(hierarchical: HierarchicalPlan, entityId: string, entities: PackingEntity[]): EntityTravelState {
  const graph = createEntityGraph(entities.map((entity) => ({ ...entity })));
  const entity = graph.entities.get(entityId);
  if (!entity) return { placed: false, reason: '物品不存在' };

  const chain: Array<{ id: string; parentId: string | null }> = [];
  let current: PackingEntity | undefined = entity;
  while (current) {
    chain.unshift({ id: current.id, parentId: current.containerId ?? null });
    current = current.containerId ? graph.entities.get(current.containerId) : undefined;
  }

  for (const link of chain) {
    const plan = link.parentId ? hierarchical.containerPlans[link.parentId]?.plan : hierarchical;
    if (!plan) return { placed: false, reason: '摆放结果缺失', blockingContainerId: link.parentId ?? undefined };
    const placement = plan.placements.find((candidate) => candidate.itemId === link.id);
    if (!placement) {
      const reason = plan.unplaced.find((candidate) => candidate.item.id === link.id)?.reason ?? '待处理';
      return { placed: false, reason, blockingContainerId: link.parentId ?? undefined };
    }
  }
  return { placed: true, reason: '' };
}
