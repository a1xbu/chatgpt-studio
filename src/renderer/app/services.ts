import type { BrowserController } from '../browser/controller';
import type { DesktopPocApi } from '../desktop-api';
import type { RendererServices } from './context';

export type RendererAppServices = RendererServices & {
  clipboard: Clipboard;
};

export function createRendererAppServices(options: {
  windowLike: Window;
  desktopPoc: DesktopPocApi;
  browserController: BrowserController;
  clipboard: Clipboard;
  storage: Storage;
}): RendererAppServices {
  return {
    desktopPoc: options.desktopPoc,
    browserController: options.browserController,
    storage: options.storage,
    timers: {
      setTimeout: (handler, timeout, ...arguments_) => options.windowLike.setTimeout(handler, timeout, ...arguments_),
      clearTimeout: (timeoutId) => options.windowLike.clearTimeout(timeoutId),
      requestAnimationFrame: (callback) => options.windowLike.requestAnimationFrame(callback),
    },
    clipboard: options.clipboard,
  };
}
