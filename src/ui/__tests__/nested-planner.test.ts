import { describe, expect, it } from 'vitest';
import { createSampleSnapshot } from '../../core/sample-data';
import { generateHierarchicalPlan } from '../../core/nested-packing';
import { usePlanner } from '../usePlanner';
import type { Container, PackingItem, PackingSnapshot } from '../../core/models';
import type { PlannerRepository } from '../../ports/planner-repository.port';

class MemoryRepository implements PlannerRepository {
  saved?: PackingSnapshot;
  constructor(private snapshot = createSampleSnapshot()) {}
  load() { return { value: structuredClone(this.snapshot) }; }
  save(snapshot: PackingSnapshot) { this.saved = structuredClone(snapshot); }
}

const item = (id: string, containerId: string | null = null): PackingItem => ({
  id, name: id, kind: 'item', category: '其他', length: 2, width: 2, height: 2, weight: 1, priority: 2, mustHave: false, containerId,
});
const container = (id: string, containerId: string | null = null, overrides: Partial<Container> = {}): Container => ({
  id, name: id, kind: 'container', category: '收纳', length: 10, width: 10, height: 10,
  innerLength: 10, innerWidth: 10, innerHeight: 10, weight: 1, priority: 2, mustHave: false, containerId, ...overrides,
});

describe('nested planner controller', () => {
  it('moves a container, persists all layer results, and prevents descendant cycles', () => {
    const suitcase = { length: 30, width: 30, height: 30, maxWeight: 20 };
    const snapshot: PackingSnapshot = { suitcase, selectedPlan: 'comfort', items: [container('outer'), container('inner'), item('a', 'inner')] };
    const repository = new MemoryRepository(snapshot);
    const planner = usePlanner({ repository, printPort: { print() {} } });

    planner.moveEntity('inner', 'outer');
    expect(planner.canMove('outer', 'inner')).toBe(false);
    expect(planner.moveEntity('outer', 'inner')).toBe(false);
    expect(repository.saved?.items.find((entity) => entity.id === 'inner')?.containerId).toBe('outer');
    expect(repository.saved?.plans?.comfort.placements.map((p) => p.itemId)).toContain('outer');
    expect(repository.saved?.plans?.comfort.containerPlans.outer.plan.unplaced).toHaveLength(0);
  });

  it('deletes a container after confirmation and retains its contents as independent outer items', () => {
    const suitcase = { length: 30, width: 30, height: 30, maxWeight: 20 };
    const snapshot: PackingSnapshot = { suitcase, selectedPlan: 'comfort', items: [container('bag'), item('lens', 'bag')] };
    const repository = new MemoryRepository(snapshot);
    const planner = usePlanner({ repository, printPort: { print() {} } });

    const impact = planner.containerImpact('bag', null);
    expect(impact?.descendants.map((entity) => entity.id)).toEqual(['lens']);
    expect(planner.removeContainer('bag')).toBe(true);
    expect(repository.saved?.items.map((entity) => entity.id)).toEqual(['lens']);
    expect(repository.saved?.items[0]?.containerId).toBeNull();
  });

  it('keeps an item that cannot fit inside its container out of the outer suitcase', () => {
    const snapshot: PackingSnapshot = {
      suitcase: { length: 30, width: 30, height: 30, maxWeight: 20 },
      selectedPlan: 'comfort',
      items: [container('bag', null, { innerLength: 1 }), item('lens', 'bag')],
    };
    const plan = generateHierarchicalPlan(snapshot, 'comfort');
    expect(plan.placements.map((p) => p.itemId)).toContain('bag');
    expect(plan.placements.map((p) => p.itemId)).not.toContain('lens');
  });
});
