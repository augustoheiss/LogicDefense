/**
 * Bounded web DOM scroll alignment helper for virtualized React Native Web FlatList comboboxes.
 *
 * React Native VirtualizedList batches offscreen window renders (~50ms default
 * `updateCellsBatchingPeriod`) and relies on a fixed `ESTIMATED_OPTION_ROW_HEIGHT` that can drift
 * when mobile options wrap onto two lines. A single 50ms timer frequently fires before the target
 * row mounts or settles. This helper polls across a small bounded schedule, adjusts only the
 * dropdown's own scroll container first (avoiding outer modal jump), and falls back to
 * `scrollIntoView` only when needed.
 */

const WEB_SCROLL_RETRY_DELAYS_MS = [20, 45, 65, 90, 120, 160] as const;

function findScrollableContainerWithin(
  el: HTMLElement,
  boundaryEl: HTMLElement | null
): HTMLElement | null {
  let cur: HTMLElement | null = el.parentElement;
  while (cur && cur !== boundaryEl && cur !== document.body && cur !== document.documentElement) {
    if (cur.scrollHeight > cur.clientHeight + 4) {
      const overflowY =
        typeof window !== 'undefined' ? window.getComputedStyle(cur).overflowY : '';
      if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
        return cur;
      }
    }
    cur = cur.parentElement;
  }
  return null;
}

export function alignWebOptionElementInViewport(params: {
  domId: string;
  rootEl: HTMLElement | null;
  alignToEnd: boolean;
  onFallbackScrollIntoView: (el: HTMLElement) => void;
}): boolean {
  if (typeof document === 'undefined') return true;
  const el = document.getElementById(params.domId);
  if (!el) return false;

  const scroller = findScrollableContainerWithin(el, params.rootEl);
  if (!scroller) {
    params.onFallbackScrollIntoView(el);
    return true;
  }

  const sRect = scroller.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  if (eRect.height <= 0 || sRect.height <= 0) return false;

  const isInsideScroller = eRect.top >= sRect.top - 1 && eRect.bottom <= sRect.bottom + 1;
  if (!isInsideScroller) {
    if (eRect.bottom > sRect.bottom) {
      scroller.scrollTop += eRect.bottom - sRect.bottom + (params.alignToEnd ? 10 : 6);
    } else if (eRect.top < sRect.top) {
      scroller.scrollTop -= sRect.top - eRect.top + 6;
    }
  }

  const nextRect = el.getBoundingClientRect();
  if (
    typeof window !== 'undefined' &&
    (nextRect.top < 0 || nextRect.bottom > window.innerHeight)
  ) {
    params.onFallbackScrollIntoView(el);
  }

  // Return false if we had to scroll so one confirmation tick verifies height didn't shift asynchronously
  return isInsideScroller;
}

export function scheduleWebOptionAlignment(params: {
  domId: string;
  getRootEl: () => HTMLElement | null;
  alignToEnd: boolean;
  onEndNotMounted?: () => void;
  onFallbackScrollIntoView: (el: HTMLElement) => void;
}): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const runAttempt = () => {
    if (cancelled) return;
    const settled = alignWebOptionElementInViewport({
      domId: params.domId,
      rootEl: params.getRootEl(),
      alignToEnd: params.alignToEnd,
      onFallbackScrollIntoView: params.onFallbackScrollIntoView,
    });
    if (settled) return;

    const elMissing = typeof document !== 'undefined' && !document.getElementById(params.domId);
    if (elMissing && params.alignToEnd && attempt === 1) {
      params.onEndNotMounted?.();
    }

    if (attempt >= WEB_SCROLL_RETRY_DELAYS_MS.length) return;
    const delay = WEB_SCROLL_RETRY_DELAYS_MS[attempt];
    attempt += 1;
    timer = setTimeout(runAttempt, delay);
  };

  timer = setTimeout(runAttempt, WEB_SCROLL_RETRY_DELAYS_MS[attempt]);
  attempt += 1;

  return () => {
    cancelled = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
