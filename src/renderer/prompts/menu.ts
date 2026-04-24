import type { PromptRecord } from '../../shared/contracts';
import type { PromptMenuState } from '../sidebar/types';
import { renderPromptItemMenu as renderPromptItemMenuImpl } from './prompt-tree';
import { toggleManagedMenu, type ManagedMenuRuntimeOptions } from '../ui/menu-runtime';

export function getPromptMenuKey(state: PromptMenuState | null): string {
  return state?.promptId ?? '';
}

export function renderPromptItemMenu(prompt: PromptRecord, escapeHtml: (value: string | null | undefined) => string): string {
  return renderPromptItemMenuImpl(prompt, { escapeHtml });
}

export function renderPromptMenuPortal(options: {
  activePromptMenu: PromptMenuState | null;
  prompts: PromptRecord[];
  promptViewPanelElement: HTMLElement | null;
  documentLike: Document;
  bodyElement: HTMLElement;
  windowLike: Pick<Window, 'innerHeight' | 'innerWidth'>;
  clearActivePromptMenuCloseTimer: () => void;
  scheduleActivePromptMenuClose: (delayMs?: number) => void;
  renderPromptItemMenu: (prompt: PromptRecord) => string;
}): void {
  const existingPortal = options.documentLike.getElementById('prompt-menu-portal');
  existingPortal?.remove();

  const menuState = options.activePromptMenu;
  if (!menuState) {
    return;
  }

  const prompt = options.prompts.find((entry) => entry.id === menuState.promptId) ?? null;
  const trigger = Array.from(options.promptViewPanelElement?.querySelectorAll('[data-action="toggle-prompt-menu"]') ?? []).find((element) => {
    return element instanceof HTMLElement && element.dataset.promptId === menuState.promptId;
  }) as HTMLElement | undefined;
  if (!prompt || !trigger) {
    return;
  }

  const portal = options.documentLike.createElement('div');
  portal.id = 'prompt-menu-portal';
  portal.className = 'prompt-menu-portal';
  portal.innerHTML = options.renderPromptItemMenu(prompt);
  portal.addEventListener('mouseenter', () => {
    options.clearActivePromptMenuCloseTimer();
  });
  portal.addEventListener('mouseleave', () => {
    options.scheduleActivePromptMenuClose(5000);
  });
  options.bodyElement.append(portal);

  const menu = portal.firstElementChild as HTMLElement | null;
  if (!menu) {
    return;
  }

  const triggerRect = trigger.getBoundingClientRect();
  const gap = 6;
  menu.style.position = 'fixed';
  menu.style.left = `${Math.max(8, triggerRect.left - 182)}px`;
  menu.style.top = `${Math.max(8, triggerRect.top - 4)}px`;
  menu.style.right = 'auto';

  const menuRect = menu.getBoundingClientRect();
  if (menuRect.bottom > options.windowLike.innerHeight - 8) {
    menu.style.top = `${Math.max(8, options.windowLike.innerHeight - menuRect.height - 8)}px`;
  }
  if (menuRect.right > options.windowLike.innerWidth - 8) {
    menu.style.left = `${Math.max(8, options.windowLike.innerWidth - menuRect.width - gap - 8)}px`;
  }
}

export function setActivePromptMenu(
  promptId: string,
  options: ManagedMenuRuntimeOptions<PromptMenuState>,
  shouldToggle = true,
): void {
  toggleManagedMenu({ promptId }, options, shouldToggle);
}
