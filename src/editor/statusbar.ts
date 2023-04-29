import { StatusBarAlignment, window } from 'vscode';
import { ExtensionModule } from '../utils';

export default (() => {
  window.createStatusBarItem(StatusBarAlignment.Right);
  // TODO: Add bar

  return [];
}) as ExtensionModule;
