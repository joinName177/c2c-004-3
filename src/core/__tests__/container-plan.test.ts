import { describe, expect, it } from 'vitest';
import { generatePlans } from '../plan-service';
import { detectRisks } from '../risk-engine';
import { canContain, getContainerImpact, removeContainerShell } from '../container-structure';
import type { Container, PackingItem, Suitcase } from '../models';

const suitcase: Suitcase = { length: 20, width: 15, height: 10, maxWeight: 10 };
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({
  id, name: id, category: '数码', length: 4, width: 4, height: 2, weight: 1, priority: 2, mustHave: false, kind: 'item', parentId: null, ...overrides,
});
const container = (id: string, overrides: Partial<Container> = {}): Container => ({
  id,
  name: id,
  category: '容器',
  length: 10,
  width: 8,
  height: 6,
  innerLength: 9,
  innerWidth: 7,
  innerHeight: 5,
  weight: 0.5,
  priority: 2,
  kind: 'container',
  parentId: null,
  ...overrides,
});

describe('nested container planning', () => {
  it('packs contents against inner dimensions and counts outer weight once', () => {
    const bag = container('bag');
    const inside = item('inside', { length: 8, width: 7, height: 5, weight: 1.2, parentId: 'bag' });
    const plan = generatePlans(suitcase, [inside], [bag]).comfort;

    expect(plan.placements).toHaveLength(1);
    expect(plan.placements[0]).toMatchObject({ itemId: 'bag', kind: 'container' });
    expect(plan.totalWeight).toBeCloseTo(1.7);
    expect(plan.loadedItemIds).toEqual(['inside']);
    expect(plan.containerPlans[0]?.innerPlan.placements[0]?.itemId).toBe('inside');
  });

  it('keeps items that do not fit inside a container pending until explicitly moved out', () => {
    const bag = container('bag', { innerLength: 4, innerWidth: 4, innerHeight: 2 });
    const inside = item('inside', { length: 8, parentId: 'bag', mustHave: true });

    const planned = generatePlans(suitcase, [inside], [bag]).comfort;
    expect(planned.placements.map((placement) => placement.itemId)).toEqual(['bag']);
    expect(planned.loadedItemIds).toEqual([]);
    expect(planned.pendingItemIds).toEqual(['inside']);
    expect(planned.pendingObjectCount).toBe(1);
    expect(detectRisks(planned, suitcase, [inside], [bag]).some((risk) => risk.id === 'missing-inside')).toBe(true);

    const movedOut: PackingItem = { ...inside, parentId: null };
    const outerPlan = generatePlans(suitcase, [movedOut], [bag]).comfort;
    expect(outerPlan.placements.map((placement) => placement.itemId).sort()).toEqual(['bag', 'inside']);
    expect(outerPlan.pendingItemIds).toEqual([]);
  });

  it('only carries the packed contents in the outer container weight', () => {
    const bag = container('bag', { length: 8, width: 8, height: 6, innerLength: 7, innerWidth: 7, innerHeight: 5 });
    const packed = item('packed', { length: 2, width: 2, height: 2, weight: 1, parentId: 'bag' });
    const overflow = item('overflow', { length: 8, width: 7, height: 5, weight: 4, parentId: 'bag' });
    const plan = generatePlans(suitcase, [packed, overflow], [bag]).comfort;

    expect(plan.containerPlans[0]?.loadedItemIds).toEqual(['packed']);
    expect(plan.totalWeight).toBeCloseTo(1.5);
    expect(plan.pendingItemIds).toEqual(['overflow']);
  });

  it('plans nested child containers and excludes their contents from outer weight again', () => {
    const parent = container('parent', { length: 12, width: 10, height: 8, innerLength: 11, innerWidth: 9, innerHeight: 7 });
    const child = container('child', { length: 5, width: 5, height: 4, innerLength: 4, innerWidth: 4, innerHeight: 3, weight: 0.2, parentId: 'parent' });
    const leaf = item('leaf', { parentId: 'child', weight: 0.7 });
    const plan = generatePlans(suitcase, [leaf], [parent, child]).comfort;

    const parentPlan = plan.containerPlans.find((candidate) => candidate.container.id === 'parent');
    const childPlan = plan.containerPlans.find((candidate) => candidate.container.id === 'child');
    expect(parentPlan?.innerPlan.placements.map((placement) => placement.itemId)).toContain('child');
    expect(childPlan?.innerPlan.placements.map((placement) => placement.itemId)).toContain('leaf');
    expect(childPlan?.packedWeight).toBeCloseTo(0.9);
    expect(parentPlan?.packedWeight).toBeCloseTo(1.4);
    expect(plan.totalWeight).toBeCloseTo(1.4);
    expect(plan.loadedItemIds).toEqual(['leaf']);
  });

  it('prevents moving a container into itself or a descendant', () => {
    const parent = container('parent');
    const child = container('child', { parentId: 'parent' });
    const containers = [parent, child];
    expect(canContain('parent', 'parent', containers)).toBe(false);
    expect(canContain('parent', 'child', containers)).toBe(false);
    expect(canContain('child', 'parent', containers)).toBe(true);
  });

  it('previews affected relationships and can remove only the container shell', () => {
    const parent = container('parent');
    const child = container('child', { parentId: 'parent' });
    const leaf = item('leaf', { parentId: 'child' });
    const impact = getContainerImpact('parent', [parent, child], [leaf]);
    expect(impact.descendants.map((entry) => entry.id)).toEqual(['parent', 'child']);
    expect(impact.items.map((entry) => entry.id)).toEqual(['leaf']);

    const result = removeContainerShell('parent', [parent, child], [leaf]);
    expect(result.containers.map((entry) => [entry.id, entry.parentId])).toEqual([['child', null]]);
    expect(result.items[0]?.parentId).toBe('child');
  });
});
