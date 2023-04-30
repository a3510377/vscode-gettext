import {
  TreeItem,
  TreeDataProvider,
  EventEmitter,
  ExtensionContext,
} from 'vscode';
import { BaseTreeItem } from './base';
import { POData, POParser } from '../../core/parse';
import { unicodeProgressBar } from '../../utils';

export class ProgressProvider implements TreeDataProvider<TreeItem> {
  protected _onDidChangeTreeData = new EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(protected ctx: ExtensionContext) {
    POData.changeEvent.event(this.refresh.bind(this));
    this.refresh();
  }

  getTreeItem(element: TreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(
    element?: BaseTreeItem
  ): Promise<TreeItem[] | null | undefined> {
    if (element) return await element.getChildren();

    return Object.values(POData.documents).map((item) => {
      return new ProgressItem(this.ctx, item);
    });
  }

  refresh() {
    this._onDidChangeTreeData.fire(void 0);
  }
}

export class ProgressItem extends BaseTreeItem {
  constructor(ctx: ExtensionContext, public readonly node: POParser) {
    super(ctx);
  }

  static test = 0;

  // @ts-expect-error
  get description() {
    const translated = this.node.translated.length;
    const all = this.node.total;

    const percent = (translated / all) * 100;
    const progress = unicodeProgressBar(Math.round(percent));

    return `${progress} ${percent.toFixed(1)}% (${translated}/${all})`;
  }

  get locale() {
    return this.node.locale;
  }

  // async getChildren(): Promise<BaseTreeItem[]> {}
}
