export function renderDownloadArrowIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3.5v6.25M5.5 7.5 8 10l2.5-2.5M3.5 12.5h9" />
    </svg>
  `;
}

export function renderCancelIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5 5l6 6M11 5 5 11" />
    </svg>
  `;
}

export function renderCheckIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.75 8.25 6.6 11.1 12.25 5.45" />
    </svg>
  `;
}

export function renderApplyIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3.25v6" />
      <path d="M5.4 6.7 8 9.3l2.6-2.6" />
      <path d="M3.75 12h8.5" />
    </svg>
  `;
}

export function renderBusyIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3.25a4.75 4.75 0 1 1-4.75 4.75" />
      <path d="M8 1.75v1.75" />
    </svg>
  `;
}

export function renderRefreshIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M12.75 5.25V2.5h-2.75" />
      <path d="M12.25 3.25a5.6 5.6 0 0 0-8.8 1.45" />
      <path d="M3.25 10.75v2.75H6" />
      <path d="M3.75 12.75a5.6 5.6 0 0 0 8.8-1.45" />
    </svg>
  `;
}

export function renderOpenFolderIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.75 4.25h4.2l1.2 1.35h6.8v6H1.75z" />
      <path d="M9.5 9.25h3.25" />
      <path d="M11.25 7.5l1.75 1.75-1.75 1.75" />
    </svg>
  `;
}

export function renderSpinnerIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.25a5.75 5.75 0 1 1-5.75 5.75" />
    </svg>
  `;
}

export function renderChevronIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5 3.75L10 8l-5 4.25" />
    </svg>
  `;
}

export function renderProjectIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.75 4.25h4.2l1.4 1.5h6.9v6.5H1.75z" />
      <path d="M1.75 4.25V2.75h4.65l1.1 1.5" />
    </svg>
  `;
}

export function renderChatIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 1.75h5l3 3v9.5H4z" />
      <path d="M9 1.75v3h3" />
      <path d="M6 8h4M6 10.25h4M6 12.5h3.25" />
    </svg>
  `;
}

export function renderPromptIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6.65 13.5h2.7" />
      <path d="M6.4 11.85h3.2" />
      <path d="M8 2.1a4.15 4.15 0 0 0-2.9 7.12c.6.57 1.02 1.08 1.2 1.73h3.4c.18-.65.6-1.16 1.2-1.73A4.15 4.15 0 0 0 8 2.1Z" />
    </svg>
  `;
}

export function renderAddIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3.25v9.5M3.25 8h9.5" />
    </svg>
  `;
}

export function renderBrowserTabIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="5.75" />
      <path d="M2.75 8h10.5M8 2.25a9.8 9.8 0 0 1 0 11.5M8 2.25a9.8 9.8 0 0 0 0 11.5" />
    </svg>
  `;
}

export function renderCloseIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4l8 8M12 4 4 12" />
    </svg>
  `;
}

export function renderOpenInBrowserIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.25 4.25h7.5v7.5h-7.5z" />
      <path d="M8.5 3h4.5v4.5M8.25 7.75L13 3" />
    </svg>
  `;
}

export function renderMoreActionsIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="3.25" cy="8" r="1"></circle>
      <circle cx="8" cy="8" r="1"></circle>
      <circle cx="12.75" cy="8" r="1"></circle>
    </svg>
  `;
}

export function renderFolderTreeIcon(isOpen = false): string {
  return isOpen
    ? `
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M1.75 5h4.2l1.2 1.3h6.8v5.95H1.75z" />
        <path d="M1.75 5V3.1H6.2L7.3 4.4" />
      </svg>
    `
    : `
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M1.75 4.3h4.2l1.2 1.3h6.8v6.1H1.75z" />
        <path d="M1.75 4.3V2.75H6.2l1.1 1.55" />
      </svg>
    `;
}

export function renderFileTreeFileIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 2.1h5l3 3V13.9H4z" />
      <path d="M9 2.1v3h3" />
      <path d="M6 8.1h4M6 10.2h4M6 12.3h3.3" />
    </svg>
  `;
}

export function renderArchiveIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 3.25h10v2.4H3z" />
      <path d="M4 5.65h8v7.1H4z" />
      <path d="M6.15 3.25h3.7v2.4h-3.7z" />
      <path d="M8 7.25v4.1M6.6 9h2.8" />
    </svg>
  `;
}


export function renderGitBranchIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="4" cy="4" r="1.6" />
      <circle cx="4" cy="12" r="1.6" />
      <circle cx="12" cy="8" r="1.6" />
      <path d="M4 5.6v4.8" />
      <path d="M5.3 11.1c3.1-.45 4.9-1.55 5.7-2.1" />
      <path d="M5.3 4.9c2.9.45 4.7 1.55 5.7 2.1" />
    </svg>
  `;
}

export function renderGenericFileIcon(): string {
  return `
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M5.5 2.5h6.2l3.8 3.8v10.2a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z"></path>
      <path d="M11.5 2.5v3.3a1 1 0 0 0 1 1h3"></path>
      <path d="M7 10.25h6"></path>
      <path d="M7 13.25h4.5"></path>
    </svg>
  `;
}
