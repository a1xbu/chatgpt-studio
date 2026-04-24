import type { DesktopPocApi } from './desktop-api';
import type { MarkdownItInstance, XtermFitAddon, XtermTerminal } from './runtime-types';

declare global {
  const Terminal: new (options?: Record<string, unknown>) => XtermTerminal;
  const FitAddon: {
    FitAddon: new () => XtermFitAddon;
  };
  const markdownit: (options?: Record<string, unknown>) => MarkdownItInstance;

  interface Window {
    desktopPoc: DesktopPocApi;
  }
}

export {};
