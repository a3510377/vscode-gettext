import { ExtensionContext, languages } from 'vscode';
import { getTextProvideDefinition } from './definition';
import { errorHandler } from './error';

export function activate(ctx: ExtensionContext) {
  ctx.subscriptions.push(
    languages.registerDefinitionProvider('po', {
      provideDefinition: getTextProvideDefinition,
    })
  );

  errorHandler(ctx);
  // TODO add auto warn Plural-Forms
  // https://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html?id=l10n/pluralforms
}

export function deactivate() {}
