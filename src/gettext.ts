import { ExtensionContext, languages } from 'vscode';
import { getTextProvideDefinition } from './definition';

export function activate(ctx: ExtensionContext) {
  ctx.subscriptions.push(
    languages.registerDefinitionProvider('po', {
      provideDefinition: getTextProvideDefinition,
    })
    // vscode.languages.registerDefinitionProvider('po', {
    //   provideDefinition: getTextProvideDefinition,
    // })
  );
}

export function deactivate() {}
