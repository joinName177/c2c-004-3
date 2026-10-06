import type { Container, PackingItem, PackingSnapshot } from './models';

const seed = (id: string, name: string, category: string, dimensions: [number, number, number], weight: number, priority: 1 | 2 | 3, mustHave = false, fragile = false, parentId: string | null = null): PackingItem => ({
  id, name, category, length: dimensions[0], width: dimensions[1], height: dimensions[2], weight, priority, mustHave, fragile, kind: 'item', parentId,
});

const container = (
  id: string,
  name: string,
  outer: [number, number, number],
  inner: [number, number, number],
  weight: number,
  priority: 1 | 2 | 3 = 2,
  parentId: string | null = null,
  mustHave = false,
): Container => ({
  id,
  name,
  category: '容器',
  length: outer[0],
  width: outer[1],
  height: outer[2],
  innerLength: inner[0],
  innerWidth: inner[1],
  innerHeight: inner[2],
  weight,
  priority,
  mustHave,
  fragile: false,
  kind: 'container',
  parentId,
});

export function createSampleSnapshot(): PackingSnapshot {
  return {
    suitcase: { length: 52, width: 35, height: 23, maxWeight: 10 },
    selectedPlan: 'comfort',
    containers: [
      container('camera-bag', '相机包', [24, 18, 14], [22, 16, 12], 0.45, 3, null, true),
      container('lens-case', '镜头筒', [9, 9, 10], [8, 8, 9], 0.12, 3, 'camera-bag'),
      container('storage-box', '配件收纳盒', [20, 14, 7], [18, 12, 5.5], 0.22, 2),
    ],
    items: [
      seed('jacket', '轻薄外套', '衣物', [30, 24, 5], 0.65, 3, true),
      seed('shoes', '运动鞋', '鞋履', [31, 20, 12], 0.9, 3, true),
      seed('camera', '微单相机', '数码', [15, 10, 8], 0.72, 3, true, true, 'camera-bag'),
      seed('lens', '备用镜头', '数码', [7, 7, 8], 0.36, 3, true, true, 'lens-case'),
      seed('charger', '相机充电器', '数码', [8, 6, 4], 0.18, 2, false, false, 'camera-bag'),
      seed('cable', '充电线', '数码', [8, 8, 3], 0.1, 2, false, false, 'camera-bag'),
      seed('sd-case', '存储卡盒', '数码', [5, 4, 1.5], 0.04, 2, false, false, 'lens-case'),
      seed('toiletry', '洗漱包', '洗护', [22, 14, 8], 0.48, 3, true),
      seed('adapter', '转换插头', '随身', [6, 5, 5], 0.16, 3, true, false, 'storage-box'),
      seed('sd-reader', '读卡器', '数码', [6, 4, 2], 0.06, 2, false, false, 'storage-box'),
      seed('book', '旅行读物', '随身', [21, 15, 2], 0.38, 1),
      seed('gifts', '伴手礼预留盒', '预留', [24, 18, 9], 0.2, 1),
    ],
  };
}
