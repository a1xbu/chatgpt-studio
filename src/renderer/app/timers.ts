export type RendererSetTimeout = (handler: TimerHandler, timeout?: number, ...arguments_: any[]) => number;
export type RendererClearTimeout = (timeoutId: number | undefined) => void;
export type RendererRequestAnimationFrame = (callback: FrameRequestCallback) => number;

export type RendererTimers = {
  setTimeout: RendererSetTimeout;
  clearTimeout: RendererClearTimeout;
  requestAnimationFrame: RendererRequestAnimationFrame;
};
