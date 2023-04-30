import { ExtensionContext } from 'vscode';

import editorModules from './editor';
import viewsModules from './views';
import { flatten } from './utils';
import { POData } from './core/parse';

export function activate(ctx: ExtensionContext) {
  // TODO add auto warn Plural-Forms
  // https://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html?id=l10n/pluralforms

  const modules = [editorModules, viewsModules];

  POData.init();

  ctx.subscriptions.push(...flatten(...modules.map((m) => m(ctx))));
}

export function deactivate() {}
