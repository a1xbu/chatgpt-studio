import {
  type BrowserNavigationDependencies,
  type BrowserNavigationElements,
  type BrowserNavigationState,
  normalizeBrowserAddress,
  openBrowserUrl,
  refreshBrowserNavigationState,
  syncBrowserControls,
  updateBrowserUrl,
  type OpenBrowserUrlOptions,
} from './navigation';

export type BrowserController = {
  getState: () => BrowserNavigationState;
  syncControls: () => void;
  updateUrl: (url: string | null | undefined) => void;
  openUrl: (url: string, options?: OpenBrowserUrlOptions) => void;
  refreshNavigationState: (nextUrl?: string | null) => void;
  normalizeAddress: (rawValue: string) => string;
};

export function createBrowserController(
  getState: () => BrowserNavigationState,
  setState: (nextState: BrowserNavigationState) => void,
  elements: BrowserNavigationElements,
  dependencies: BrowserNavigationDependencies,
): BrowserController {
  return {
    getState,
    syncControls: () => {
      syncBrowserControls(getState(), elements);
    },
    updateUrl: (url) => {
      updateBrowserUrl(elements.browserUrlElement, url);
    },
    openUrl: (url, options = {}) => {
      const nextState = openBrowserUrl(url, getState(), elements, dependencies, options);
      setState(nextState);
    },
    refreshNavigationState: (nextUrl) => {
      const nextState = refreshBrowserNavigationState(getState(), elements, dependencies.normalizeStoredUrl, nextUrl);
      setState(nextState);
    },
    normalizeAddress: normalizeBrowserAddress,
  };
}
