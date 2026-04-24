
export type ChatHistoryEventsElements = {
  chatHistoryViewElement: HTMLElement | null;
};

export type ChatHistoryEventsHelpers = {
  findClosestHtmlElement: (target: EventTarget | null, selector: string) => HTMLElement | null;
  showItemInFolder: (filePath: string) => Promise<unknown> | void;
  openLocalChatInChatGpt: (projectId: string, chatId: string, chatUrl: string) => void;
};

export function bindChatHistoryEvents(
  elements: ChatHistoryEventsElements,
  helpers: ChatHistoryEventsHelpers,
): void {
  elements.chatHistoryViewElement?.addEventListener('click', (event) => {
    const actionElement = helpers.findClosestHtmlElement(event.target, '[data-action]');
    if (!actionElement) {
      return;
    }

    if (actionElement.dataset.action === 'show-file-in-folder') {
      const filePath = actionElement.dataset.filePath ?? '';
      if (!filePath) {
        return;
      }

      event.preventDefault();
      void helpers.showItemInFolder(filePath);
      return;
    }

    if (actionElement.dataset.action === 'open-local-chat-in-chatgpt') {
      const projectId = actionElement.dataset.projectId ?? '';
      const chatId = actionElement.dataset.chatId ?? '';
      const chatUrl = actionElement.dataset.chatUrl ?? '';
      if (!chatUrl) {
        return;
      }

      event.preventDefault();
      helpers.openLocalChatInChatGpt(projectId, chatId, chatUrl);
    }
  });
}
