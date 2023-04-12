import { ExtensionContext, languages } from 'vscode';
import { getTextProvideDefinition } from './definition';
import { formatString } from './format';

export function activate(ctx: ExtensionContext) {
  // annotation(ctx);

  ctx.subscriptions.push(
    languages.registerDefinitionProvider('po', {
      provideDefinition: getTextProvideDefinition,
    })
  );

  formatString(ctx);
  // TODO add auto warn Plural-Forms
  // https://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html?id=l10n/pluralforms
}

export function deactivate() {}
