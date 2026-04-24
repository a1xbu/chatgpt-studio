export type ClipboardLike = {
  writeText?: (value: string) => Promise<void>;
} | null | undefined;

export type DocumentClipboardFallbackLike = Pick<Document, 'body' | 'createElement' | 'execCommand'>;

export async function copyTextToClipboard(
  text: string,
  clipboard: ClipboardLike,
  documentLike: DocumentClipboardFallbackLike,
): Promise<void> {
  if (clipboard?.writeText) {
    await clipboard.writeText(text);
    return;
  }

  const fallbackInput = documentLike.createElement('textarea');
  fallbackInput.value = text;
  fallbackInput.style.position = 'fixed';
  fallbackInput.style.opacity = '0';
  documentLike.body.appendChild(fallbackInput);
  fallbackInput.select();
  documentLike.execCommand('copy');
  fallbackInput.remove();
}
