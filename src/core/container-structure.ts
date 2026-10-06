import type { Container, PackingItem, PackingSnapshot } from './models';


function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function positive(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeContainer(raw: unknown): Container | null {
  const data = asRecord(raw);
  if (typeof data.id !== 'string' || typeof data.name !== 'string') return null;
  const length = positive(data.length, 1);
  const width = positive(data.width, 1);
  const height = positive(data.height, 1);
  const weight = typeof data.weight === 'number' && Number.isFinite(data.weight) && data.weight >= 0 ? data.weight : 0;
  const priority = [1, 2, 3].includes(Number(data.priority)) ? Number(data.priority) as 1 | 2 | 3 : 2;
  return {
    id: data.id,
    name: data.name,
    category: '容器',
    weight,
    priority,
    mustHave: Boolean(data.mustHave),
    fragile: Boolean(data.fragile),
    kind: 'container',
    parentId: typeof data.parentId === 'string' ? data.parentId : null,
    length,
    width,
    height,
    innerLength: Math.min(positive(data.innerLength, length), length),
    innerWidth: Math.min(positive(data.innerWidth, width), width),
    innerHeight: Math.min(positive(data.innerHeight, height), height),
  };
}

function normalizeItem(raw: unknown, validContainerIds: Set<string>): PackingItem | null {
  const data = asRecord(raw);
  if (typeof data.id !== 'string' || typeof data.name !== 'string') return null;
  const parentId = typeof data.parentId === 'string' && validContainerIds.has(data.parentId) ? data.parentId : null;
  const priority = [1, 2, 3].includes(Number(data.priority)) ? Number(data.priority) as 1 | 2 | 3 : 2;
  return {
    id: data.id,
    name: data.name,
    category: typeof data.category === 'string' ? data.category : '其他',
    weight: positive(data.weight, 0.1),
    priority,
    mustHave: Boolean(data.mustHave),
    fragile: Boolean(data.fragile),
    kind: 'item',
    parentId,
    length: positive(data.length, 1),
    width: positive(data.width, 1),
    height: positive(data.height, 1),
  };
}

function breakContainerCycles(containers: Container[]): Container[] {
  const byId = new Map(containers.map((container) => [container.id, container]));
  return containers.map((container) => {
    let current = container.parentId;
    let guard = 0;
    while (current && guard <= containers.length + 1) {
      if (current === container.id) return { ...container, parentId: null };
      current = byId.get(current)?.parentId ?? null;
      guard += 1;
    }
    return current ? { ...container, parentId: null } : container;
  });
}

export function normalizeSnapshot(raw: Partial<PackingSnapshot> | null | undefined): PackingSnapshot {
  const source = asRecord(raw);
  const suitcaseSource = asRecord(source.suitcase);
  const rawContainers = Array.isArray(source.containers) ? source.containers : [];
  const containers = breakContainerCycles(rawContainers.map(normalizeContainer).filter((candidate): candidate is Container => Boolean(candidate)));
  const validContainerIds = new Set(containers.map((container) => container.id));
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const items = rawItems.map((rawItem) => normalizeItem(rawItem, validContainerIds)).filter((candidate): candidate is PackingItem => Boolean(candidate));
  return {
    suitcase: {
      length: positive(suitcaseSource.length, 52),
      width: positive(suitcaseSource.width, 35),
      height: positive(suitcaseSource.height, 23),
      maxWeight: positive(suitcaseSource.maxWeight, 10),
    },
    items,
    containers: containers.map((container) => ({
      ...container,
      parentId: container.parentId && validContainerIds.has(container.parentId) ? container.parentId : null,
    })),
    selectedPlan: source.selectedPlan === 'minimal' || source.selectedPlan === 'shopping' ? source.selectedPlan : 'comfort',
  };
}

export function getDescendantIds(containerId: string, containers: Container[]): string[] {
  const children = containers.filter((container) => container.parentId === containerId);
  return [containerId, ...children.flatMap((child) => getDescendantIds(child.id, containers))];
}

export function canContain(movingContainerId: string, targetContainerId: string | null, containers: Container[]): boolean {
  if (movingContainerId === targetContainerId) return false;
  if (!targetContainerId) return true;
  return !getDescendantIds(movingContainerId, containers).includes(targetContainerId);
}

export interface ContainerImpact {
  descendants: Container[];
  items: PackingItem[];
}

export function getContainerImpact(containerId: string, containers: Container[], items: PackingItem[]): ContainerImpact {
  const ids = new Set(getDescendantIds(containerId, containers));
  return {
    descendants: containers.filter((container) => ids.has(container.id)),
    items: items.filter((item) => item.parentId && ids.has(item.parentId)),
  };
}

export function removeContainerShell(
  containerId: string,
  containers: Container[],
  items: PackingItem[],
): { containers: Container[]; items: PackingItem[] } {
  const removed = containers.find((container) => container.id === containerId);
  if (!removed) return { containers, items };
  return {
    containers: containers
      .filter((container) => container.id !== containerId)
      .map((container) => container.parentId === containerId ? { ...container, parentId: removed.parentId ?? null } : container),
    items: items.map((item) => item.parentId === containerId ? { ...item, parentId: removed.parentId ?? null } : item),
  };
}

export function removeContainerWithContents(
  containerId: string,
  containers: Container[],
  items: PackingItem[],
): { containers: Container[]; items: PackingItem[] } {
  const ids = new Set(getDescendantIds(containerId, containers));
  return {
    containers: containers.filter((container) => !ids.has(container.id)),
    items: items.filter((item) => !item.parentId || !ids.has(item.parentId)),
  };
}
