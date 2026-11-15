/**
 * Unit tests for `@coin/utils/comboboxScrollHelper`
 * Verifies bounded scroll retries when FlatList mounts tail options asynchronously,
 * internal scroller adjustment, outer viewport fallback, and timer cancellation.
 */

declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare function expect(actual: any): {
  toBe(expected: any): void;
  toBeGreaterThan(expected: any): void;
};

import {
  alignWebOptionElementInViewport,
  scheduleWebOptionAlignment,
} from '../utils/comboboxScrollHelper';

function withMockDom(run: () => Promise<void> | void): Promise<void> {
  const prevDoc = (globalThis as any).document;
  const prevWin = (globalThis as any).window;
  return Promise.resolve(run()).finally(() => {
    if (prevDoc === undefined) delete (globalThis as any).document;
    else (globalThis as any).document = prevDoc;

    if (prevWin === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = prevWin;
  });
}

describe('comboboxScrollHelper', () => {
  it('scrolls internal scroller down when virtualized option sits below scroller fold without calling fallback inside viewport', async () => {
    await withMockDom(() => {
      const rootEl = { tagName: 'DIV' } as unknown as HTMLElement;
      const scrollerEl: any = {
        scrollHeight: 9000,
        clientHeight: 260,
        scrollTop: 7640,
        parentElement: rootEl,
        getBoundingClientRect: () => ({ top: 500, bottom: 760, height: 260 }),
      };
      const optionEl: any = {
        parentElement: scrollerEl,
        getBoundingClientRect: () => ({
          top: 500 + (1200 - scrollerEl.scrollTop),
          bottom: 500 + (1200 - scrollerEl.scrollTop) + 68,
          height: 68,
        }),
      };
      scrollerEl.scrollTop = 700; // eRect = 1000..1068 -> below sRect bottom 760

      (globalThis as any).document = {
        body: {},
        documentElement: {},
        getElementById: (id: string) => (id === 'opt-last' ? optionEl : null),
      };
      (globalThis as any).window = {
        innerHeight: 844,
        getComputedStyle: (el: any) => ({ overflowY: el === scrollerEl ? 'auto' : 'visible' }),
      };

      let fallbackCalls = 0;
      const settledFirst = alignWebOptionElementInViewport({
        domId: 'opt-last',
        rootEl,
        alignToEnd: true,
        onFallbackScrollIntoView: () => {
          fallbackCalls += 1;
        },
      });

      // Scroll adjusted downward and returns false on shift pass to allow layout confirmation
      expect(settledFirst).toBe(false);
      expect(scrollerEl.scrollTop).toBeGreaterThan(700);
      expect(fallbackCalls).toBe(0);

      // Confirmation pass sees element now inside scroller bounds
      const settledSecond = alignWebOptionElementInViewport({
        domId: 'opt-last',
        rootEl,
        alignToEnd: true,
        onFallbackScrollIntoView: () => {
          fallbackCalls += 1;
        },
      });
      expect(settledSecond).toBe(true);
    });
  });

  it('invokes fallback scrollIntoView when internal alignment leaves element outside window viewport', async () => {
    await withMockDom(() => {
      const rootEl = { tagName: 'DIV' } as unknown as HTMLElement;
      const scrollerEl: any = {
        scrollHeight: 800,
        clientHeight: 260,
        scrollTop: 0,
        parentElement: rootEl,
        getBoundingClientRect: () => ({ top: 624, bottom: 884, height: 260 }),
      };
      const optionEl: any = {
        parentElement: scrollerEl,
        getBoundingClientRect: () => ({ top: 800, bottom: 868, height: 68 }),
      };

      (globalThis as any).document = {
        body: {},
        documentElement: {},
        getElementById: (id: string) => (id === 'opt-clipped' ? optionEl : null),
      };
      (globalThis as any).window = {
        innerHeight: 844,
        getComputedStyle: () => ({ overflowY: 'auto' }),
      };

      let fallbackCount = 0;
      const settled = alignWebOptionElementInViewport({
        domId: 'opt-clipped',
        rootEl,
        alignToEnd: true,
        onFallbackScrollIntoView: () => {
          fallbackCount += 1;
        },
      });

      expect(settled).toBe(true);
      expect(fallbackCount).toBe(1);
    });
  });

  it('retries across frames until late-mounted virtualized item appears and invokes onEndNotMounted once', async () => {
    await withMockDom(async () => {
      const rootEl = { tagName: 'DIV' } as unknown as HTMLElement;
      const scrollerEl: any = {
        scrollHeight: 2000,
        clientHeight: 240,
        scrollTop: 0,
        parentElement: rootEl,
        getBoundingClientRect: () => ({ top: 200, bottom: 440, height: 240 }),
      };
      let mounted = false;
      const optionEl: any = {
        parentElement: scrollerEl,
        getBoundingClientRect: () => ({
          top: 520 - scrollerEl.scrollTop,
          bottom: 580 - scrollerEl.scrollTop,
          height: 60,
        }),
      };

      (globalThis as any).document = {
        body: {},
        documentElement: {},
        getElementById: (id: string) => (mounted && id === 'opt-late' ? optionEl : null),
      };
      (globalThis as any).window = {
        innerHeight: 844,
        getComputedStyle: () => ({ overflowY: 'auto' }),
      };

      let endFallbackCount = 0;
      const cancel = scheduleWebOptionAlignment({
        domId: 'opt-late',
        getRootEl: () => rootEl,
        alignToEnd: true,
        onEndNotMounted: () => {
          endFallbackCount += 1;
          mounted = true;
        },
        onFallbackScrollIntoView: () => {},
      });

      await new Promise((r) => setTimeout(r, 250));
      cancel();

      expect(endFallbackCount).toBe(1);
      expect(scrollerEl.scrollTop).toBeGreaterThan(0);
    });
  });
});
