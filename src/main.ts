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
}

export function deactivate() {}
