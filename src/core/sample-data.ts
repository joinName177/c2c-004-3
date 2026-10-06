import type { Container, PackingEntity, PackingItem, PackingSnapshot } from './models';

const seedItem = (id: string, name: string, category: string, dimensions: [number, number, number], weight: number, priority: 1 | 2 | 3, mustHave = false, fragile = false, containerId: string | null = null): PackingItem => ({
  id, name, category, kind: 'item', length: dimensions[0], width: dimensions[1], height: dimensions[2], weight, priority, mustHave, fragile, containerId,
});

const seedContainer = (
  id: string,
  name: string,
  category: string,
  outer: [number, number, number],
  inner: [number, number, number],
  weight: number,
  priority: 1 | 2 | 3,
  mustHave = false,
  containerId: string | null = null,
): Container => ({
  id, name, category, kind: 'container',
  length: outer[0], width: outer[1], height: outer[2],
  innerLength: inner[0], innerWidth: inner[1], innerHeight: inner[2],
  weight, priority, mustHave, containerId,
});

export function createSampleSnapshot(): PackingSnapshot {
  return {
    suitcase: { length: 52, width: 35, height: 23, maxWeight: 10 },
    selectedPlan: 'comfort',
    items: [
      seedItem('jacket', '轻薄外套', '衣物', [30, 24, 5], 0.65, 3, true),
      seedItem('shoes', '运动鞋', '鞋履', [31, 20, 12], 0.9, 3, true),
      seedContainer('camera-bag', '相机包', '数码收纳', [26, 20, 17], [24, 18, 15], 0.42, 3),
      seedItem('camera', '微单相机', '数码', [18, 14, 10], 0.72, 2, true, true, 'camera-bag'),
      seedContainer('lens-pouch', '镜头小袋', '数码收纳', [10, 9, 8], [8, 7, 6], 0.08, 3, true, 'camera-bag'),
      seedItem('lens', '定焦镜头', '数码', [7, 6, 5], 0.32, 3, true, true, 'lens-pouch'),
      seedItem('charger', '相机充电器', '数码', [10, 7, 4], 0.24, 2, false, false, 'camera-bag'),
      seedItem('toiletry', '洗漱包', '洗护', [22, 14, 8], 0.48, 3, true),
      seedItem('book', '旅行读物', '随身', [21, 15, 2], 0.38, 1),
      seedContainer('gift-box', '伴手礼收纳盒', '预留', [22, 15, 7], [20, 13, 5], 0.2, 1),
      seedItem('souvenir', '小纪念品', '预留', [15, 10, 4], 0.12, 1, false, false, 'gift-box'),
    ] satisfies PackingEntity[],
  };
}
