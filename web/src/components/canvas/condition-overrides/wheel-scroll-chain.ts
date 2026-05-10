import { useCallback, useRef } from "react";

const EDGE_PX = 2;
/** Milliseconds to wait at an inner scroll boundary before forwarding to the parent. */
export const CHAIN_FORWARD_BUFFER_MS = 150;

function findVerticalScrollParent(from: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = from.parentElement;
  while (el) {
    const { overflowY } = window.getComputedStyle(el);
    if (
      (overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay") &&
      el.scrollHeight > el.clientHeight + EDGE_PX
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * Forwards wheel deltas to the nearest scrollable ancestor when this element
 * is already at a scroll boundary (top or bottom). Fixes the sluggish
 * hand-off browsers apply with default scroll chaining on nested
 * `overflow-y: auto` regions.
 *
 * A short delay ({@link CHAIN_FORWARD_BUFFER_MS}ms) before forwarding wheel
 * once the inner list hits a boundary — softens the hand-off without the
 * full browser scroll-chaining lag.
 */
export class WheelScrollChainCoordinator {
  private readonly scrollEl: HTMLElement;
  private readonly boundWheel: (event: WheelEvent) => void;
  private stuckAtBottomSince: number | null = null;
  private stuckAtTopSince: number | null = null;

  constructor(scrollEl: HTMLElement) {
    this.scrollEl = scrollEl;
    this.boundWheel = this.handleWheel.bind(this);
    scrollEl.addEventListener("wheel", this.boundWheel, { passive: false });
  }

  dispose(): void {
    this.scrollEl.removeEventListener("wheel", this.boundWheel);
  }

  private handleWheel(event: WheelEvent): void {
    const { deltaY } = event;
    if (deltaY === 0) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = this.scrollEl;
    const innerScrollable = scrollHeight > clientHeight + EDGE_PX;
    const atTop = scrollTop <= EDGE_PX;
    const atBottom =
      scrollTop + clientHeight >= scrollHeight - EDGE_PX;
    const scrollingDown = deltaY > 0;
    const scrollingUp = deltaY < 0;

    const shouldChainToParent =
      !innerScrollable ||
      (scrollingDown && atBottom) ||
      (scrollingUp && atTop);

    if (!shouldChainToParent) {
      // In this branch `innerScrollable` is always true (otherwise we would chain).
      if (!atBottom) {
        this.stuckAtBottomSince = null;
      }
      if (!atTop) {
        this.stuckAtTopSince = null;
      }
      return;
    }

    if (!innerScrollable) {
      this.stuckAtBottomSince = null;
      this.stuckAtTopSince = null;
    } else {
      if (scrollingDown && atBottom) {
        this.stuckAtTopSince = null;
        this.stuckAtBottomSince ??= Date.now();
        if (Date.now() - this.stuckAtBottomSince < CHAIN_FORWARD_BUFFER_MS) {
          return;
        }
      }
      if (scrollingUp && atTop) {
        this.stuckAtBottomSince = null;
        this.stuckAtTopSince ??= Date.now();
        if (Date.now() - this.stuckAtTopSince < CHAIN_FORWARD_BUFFER_MS) {
          return;
        }
      }
    }

    const parent = findVerticalScrollParent(this.scrollEl);
    if (!parent) {
      return;
    }

    const parentMax = Math.max(
      0,
      parent.scrollHeight - parent.clientHeight,
    );
    const nextTop = Math.max(
      0,
      Math.min(parentMax, parent.scrollTop + deltaY),
    );
    if (nextTop === parent.scrollTop) {
      return;
    }

    parent.scrollTop = nextTop;
    event.preventDefault();
    event.stopPropagation();
  }
}

export function attachWheelScrollChain(
  scrollEl: HTMLElement,
): () => void {
  const coordinator = new WheelScrollChainCoordinator(scrollEl);
  return () => {
    coordinator.dispose();
  };
}

/**
 * Callback ref that attaches {@link attachWheelScrollChain} when the node mounts.
 */
export function useAttachWheelScrollChain(): (node: HTMLElement | null) => void {
  const detachRef = useRef<(() => void) | null>(null);
  return useCallback((node: HTMLElement | null) => {
    detachRef.current?.();
    detachRef.current = null;
    if (node) {
      detachRef.current = attachWheelScrollChain(node);
    }
  }, []);
}
