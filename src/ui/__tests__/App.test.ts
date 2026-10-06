import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from '../App.vue';
import { LocalPlannerRepository } from '../../adapters/local-planner.repository';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

function render() {
  let printCount = 0;
  const wrapper = mount(App, { props: {
    repository: new LocalPlannerRepository(new MemoryStorage()),
    printPort: { print: () => { printCount += 1; } },
  } });
  return { wrapper, getPrintCount: () => printCount };
}

describe('Luggage planner App', () => {
  it('renders sample luggage and catches invalid dimensions', async () => {
    const { wrapper } = render();
    expect(wrapper.text()).toContain('行李箱空间规划师');
    expect(wrapper.text()).toContain('轻薄外套');
    await wrapper.get('[aria-label="行李箱长度"]').setValue('0');
    expect(wrapper.text()).toContain('行李箱长度必须大于 0');
  });

  it('adds and deletes an item', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="物品名称"]').setValue('新物品');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.text()).toContain('新物品');
    await wrapper.get('[aria-label="删除 新物品"]').trigger('click');
    expect(wrapper.text()).not.toContain('新物品');
  });

  it('opens a container layer from the packing map', async () => {
    const { wrapper } = render();
    const cameraBag = wrapper.findAll('[data-item-id="camera-bag"]')[0];
    await cameraBag.trigger('click');
    expect(wrapper.text()).toContain('相机包摆放方案');
    expect(wrapper.findAll('[data-item-id="camera"]')).toHaveLength(2);
  });

  it('keeps a child pending inside its container until explicitly moved out', async () => {
    const { wrapper } = render();
    await wrapper.findAll('[data-item-id="gift-box"]')[0].trigger('click');
    expect(wrapper.text()).toContain('伴手礼收纳盒摆放方案');
    expect(wrapper.find('[data-testid="move-out-pending"]').exists()).toBe(false);
    await wrapper.get('[data-testid="layer-crumb"]').trigger('click');
    await wrapper.get('[aria-label="物品名称"]').setValue('大号支架');
    await wrapper.get('[aria-label="外长或物品长度"]').setValue('30');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    await wrapper.findAll('[data-testid="move-entity"]').at(-1)?.trigger('click');
    await wrapper.get('[aria-label="目标容器"]').setValue('gift-box');
    await wrapper.get('[data-testid="confirm-container-action"]').trigger('click');
    await wrapper.findAll('[data-item-id="gift-box"]')[0].trigger('click');
    const moveButton = wrapper.get('[data-testid="move-out-pending"]');
    expect(moveButton.text()).toContain('明确移出');
    await moveButton.trigger('click');
    expect(wrapper.find('[data-testid="move-out-pending"]').exists()).toBe(false);
  });

  it('shows affected contents and confirms deleting a container', async () => {
    const { wrapper } = render();
    await wrapper.get('[data-testid="delete-container"]').trigger('click');
    expect(wrapper.get('[data-testid="container-modal"]').text()).toContain('微单相机');
    expect(wrapper.get('[data-testid="container-modal"]').text()).toContain('镜头小袋');
    await wrapper.get('[data-testid="confirm-container-action"]').trigger('click');
    expect(wrapper.text()).not.toContain('相机包 容器');
    expect(wrapper.text()).toContain('微单相机');
  });

  it('selects a plan and highlights the same item in both projections', async () => {
    const { wrapper } = render();
    await wrapper.get('[data-plan="shopping"]').trigger('click');
    expect(wrapper.get('[data-plan="shopping"]').classes()).toContain('active');
    const jacket = wrapper.findAll('[data-item-id="jacket"]');
    expect(jacket.length).toBe(2);
    await jacket[0].trigger('click');
    expect(wrapper.findAll('[data-item-id="jacket"].selected')).toHaveLength(2);
  });

  it('delegates printing through the print port', async () => {
    const { wrapper, getPrintCount } = render();
    await wrapper.get('[data-testid="print-button"]').trigger('click');
    expect(getPrintCount()).toBe(1);
  });
});
