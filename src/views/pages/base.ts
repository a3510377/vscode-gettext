import { ExtensionContext, TreeItem } from 'vscode';

export abstract class BaseTreeItem extends TreeItem {
  constructor(public readonly ctx: ExtensionContext) {
    super('');
  }

  async getChildren(): Promise<BaseTreeItem[]> {
    return [];
  }
}
