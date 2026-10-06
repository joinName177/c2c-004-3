import { describe, expect, it } from 'vitest';
import {
  createEntityGraph,
  descendantIds,
  generateHierarchicalPlan,
  isEntityPlaced,
  normalizeEntities,
  pendingReason,
  wouldCreateCycle,
} from '../nested-packing';
import { detectHierarchyRisks } from '../hierarchy-risk';
import type { Container, PackingEntity, PackingItem, Suitcase } from '../models';

const suitcase: Suitcase = { length: 20, width: 20, height: 20, maxWeight: 10 };
const item = (id: string, overrides: Partial<PackingItem> = {}, containerId: string | null = null): PackingItem => ({
  id, name: id, category: '其他', kind: 'item', length: 2, width: 2, height: 2, weight: 1, priority: 2, mustHave: false, containerId, ...overrides,
});
const container = (id: string, overrides: Partial<Container> = {}, containerId: string | null = null): Container => ({
  id, name: id, category: '收纳', kind: 'container',
  length: 8, width: 8, height: 8, innerLength: 6, innerWidth: 6, innerHeight: 6,
  weight: 1, priority: 2, mustHave: false, containerId, ...overrides,
});

describe('generateHierarchicalPlan', () => {
  it('packs children by inner dimensions and counts outer weight once', () => {
    const childA = item('a', { weight: 0.5 }, 'bag');
    const childB = item('b', { weight: 0.7 }, 'bag');
    const bag = container('bag', { weight: 0.3 });
    const plan = generateHierarchicalPlan({ suitcase, items: [bag, childA, childB] }, 'comfort');

    expect(plan.placements.map((p) => p.itemId)).toEqual(['bag']);
    expect(plan.totalWeight).toBeCloseTo(1.5);
    expect(plan.containerPlans.bag.plan.placements).toHaveLength(2);
    expect(plan.unplaced).toHaveLength(0);
  });

  it('keeps children that do not fit inside their container pending instead of moving them outside', () => {
    const huge = item('lens', { length: 9, mustHave: true }, 'bag');
    const bag = container('bag');
    const plan = generateHierarchicalPlan({ suitcase, items: [bag, huge] }, 'comfort');

    expect(plan.placements.map((p) => p.itemId)).toEqual(['bag']);
    expect(plan.unplaced).toHaveLength(0);
    expect(plan.containerPlans.bag.plan.unplaced.map((entry) => entry.item.id)).toEqual(['lens']);
    expect(pendingReason(plan, 'lens', 'bag')).toContain('空间');
    expect(isEntityPlaced(plan, 'lens', 'bag')).toBe(false);
  });

  it('packs nested containers with recursively consolidated self and loaded weight', () => {
    const lens = item('lens', { weight: 0.4 }, 'pouch');
    const pouch = container('pouch', {
      length: 4, width: 4, height: 4, innerLength: 3, innerWidth: 3, innerHeight: 3, weight: 0.1,
    }, 'bag');
    const bag = container('bag', { weight: 0.2 });
    const plan = generateHierarchicalPlan({ suitcase, items: [bag, pouch, lens] }, 'comfort');

    expect(plan.totalWeight).toBeCloseTo(0.7);
    expect(plan.containerPlans.pouch.plan.totalWeight).toBeCloseTo(0.5);
    expect(plan.containerPlans.bag.plan.placements.map((p) => p.itemId)).toEqual(['pouch']);
  });

  it('reports a required item as missing when any ancestor container is not packed', () => {
    const bag = container('bag', { length: 40, width: 22, height: 22, innerLength: 20, innerWidth: 20, innerHeight: 20 });
    const huge = item('required', { length: 8, width: 20, height: 2, mustHave: true }, 'bag');
    const suitcaseTooSmall: Suitcase = { length: 12, width: 12, height: 12, maxWeight: 10 };
    const plan = generateHierarchicalPlan({ suitcase: suitcaseTooSmall, items: [bag, huge] }, 'comfort');
    expect(plan.placements).toHaveLength(0);
    expect(plan.containerPlans.bag.plan.placements.map((p) => p.itemId)).toEqual(['required']);
    const risks = detectHierarchyRisks(suitcaseTooSmall, [bag, huge], plan);
    expect(risks).toContainEqual(expect.objectContaining({ id: 'missing-required-hierarchy', severity: 'critical' }));
  });
});

describe('container ownership rules', () => {
  it('prevents a container being moved into itself or a descendant', () => {
    const outer = container('outer');
    const inner = container('inner', {}, 'outer');
    const graph = createEntityGraph([outer, inner]);
    expect(wouldCreateCycle(graph, 'outer', 'inner')).toBe(true);
    expect(wouldCreateCycle(graph, 'outer', 'outer')).toBe(true);
    expect(wouldCreateCycle(graph, 'outer', null)).toBe(false);
    expect(descendantIds(graph, 'outer')).toEqual(['inner']);
  });

  it('normalizes cyclic persisted ownership back to independent root items', () => {
    const a = container('a', {}, 'b');
    const b = container('b', {}, 'a');
    const normalized = normalizeEntities([a, b]) as Container[];
    expect(normalized.every((entity) => entity.containerId === null)).toBe(true);
  });
});
