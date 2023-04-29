import { ExtensionContext } from 'vscode';

import editorModules from './editor';
import { flatten } from './utils';

export function activate(ctx: ExtensionContext) {
  // TODO add auto warn Plural-Forms
  // https://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html?id=l10n/pluralforms

  const modules = [editorModules];

  ctx.subscriptions.push(...flatten(...modules.map((m) => m(ctx))));
}

export function deactivate() {}
