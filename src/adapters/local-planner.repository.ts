import { createSampleSnapshot } from '../core/sample-data';
import { generateHierarchicalPlans, normalizeSnapshot } from '../core/nested-packing';
import type { PackingSnapshot } from '../core/models';
import type { LoadResult, PlannerRepository } from '../ports/planner-repository.port';

const KEY = 'c2c-004.planner';

export class LocalPlannerRepository implements PlannerRepository {
  constructor(private readonly storage: Storage) {}

  load(): LoadResult<PackingSnapshot> {
    const raw = this.storage.getItem(KEY);
    if (!raw) return { value: createSampleSnapshot() };
    try {
      const parsed = JSON.parse(raw) as Partial<PackingSnapshot>;
      const snapshot = normalizeSnapshot(parsed, createSampleSnapshot());
      // Packing coordinates and consolidated weights are derived results. They
      // are persisted for display/print, but rebuilt on load so they can never
      // drift from the current ownership tree.
      snapshot.plans = generateHierarchicalPlans(snapshot);
      return { value: snapshot };
    } catch {
      return { value: createSampleSnapshot(), warning: '本地数据无法读取，已恢复示例。' };
    }
  }

  save(snapshot: PackingSnapshot): void {
    this.storage.setItem(KEY, JSON.stringify(snapshot));
  }
}
