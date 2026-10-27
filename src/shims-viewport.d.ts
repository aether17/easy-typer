// The project's TypeScript 3.9 DOM library predates these browser APIs.
interface VisualViewport extends EventTarget {
  readonly height: number;
  readonly offsetTop: number;
}

interface Window {
  readonly visualViewport?: VisualViewport | null;
}

interface ResizeObserver {
  observe(target: Element): void;
  disconnect(): void;
}

declare var ResizeObserver: {
  new(callback: () => void): ResizeObserver;
}
