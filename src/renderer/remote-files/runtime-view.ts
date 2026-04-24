import { renderRemoteFilesPanel, type RemoteFilesPanelViewOptions } from './view';

export type RenderNewFilesPanelOptions = RemoteFilesPanelViewOptions;

export function renderNewFilesPanel(options: RenderNewFilesPanelOptions): void {
  renderRemoteFilesPanel(options);
}
