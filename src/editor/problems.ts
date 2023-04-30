/* eslint-disable @typescript-eslint/naming-convention */
import {
  CodeAction,
  CodeActionKind,
  CodeActionProvider,
  Command,
  DocumentSemanticTokensProvider,
  ProviderResult,
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  TextDocument,
  WorkspaceEdit,
  languages,
} from 'vscode';

import { ErrorDataType, errorsHandler } from './problems_message';
import { POData, postDataToRang } from '../core/parse';
import { ExtensionModule } from '../utils';

const legend = new SemanticTokensLegend([
  'po-auto-format-placeholder',
  'po-auto-storage-format',
]);

export class ProblemProvider
  implements DocumentSemanticTokensProvider, CodeActionProvider
{
  provideDocumentSemanticTokens(
    document: TextDocument
  ): ProviderResult<SemanticTokens> {
    const tokensBuilder = new SemanticTokensBuilder(legend);

    POData.getStaticDocuments(document).items.forEach(
      ({ options: { msgid, msgstr, msgidPlural }, formatRegex }) => {
        for (const d of [msgid, msgstr, msgidPlural]) {
          const range = d && postDataToRang(...d)?.range;
          if (!range) continue;

          const i = range.start.line;
          [...document.getText(range).matchAll(formatRegex)]
            .map((d) => ({
              index: d.index || 0,
              match: d[0],
              groups: d.groups,
            }))
            .forEach(({ match, index, groups: { arg } = {} }) => {
              if (!arg) {
                tokensBuilder.push(i, index, match.length, 0);
                return;
              }

              const name = match.slice(0, match.length - arg.length - 1);

              tokensBuilder.push(i, index, name.length, 0);
              tokensBuilder.push(i, index + name.length, arg.length, 1);
              tokensBuilder.push(
                i,
                index + name.length + arg.length,
                match.length - name.length - arg.length,
                0
              );
            });
        }
      }
    );

    return tokensBuilder.build();
  }

  provideCodeActions(
    document: TextDocument
  ): ProviderResult<(CodeAction | Command)[]> {
    const actions: CodeAction[] = [];

    for (const diagnostic of languages.getDiagnostics(document.uri)) {
      const errorData = diagnostic.code as ErrorDataType;
      const errorCode = errorData.value;

      if (errorsHandler?.[errorCode]) {
        const quickFix = new CodeAction(
          `fix ${errorCode}`,
          CodeActionKind.QuickFix
        );

        quickFix.isPreferred = true;
        quickFix.edit = new WorkspaceEdit();
        quickFix.diagnostics = [diagnostic];

        errorsHandler[errorCode]?.(document, quickFix.edit, diagnostic);

        actions.push(quickFix);
      }
    }

    return actions;
  }
}

export default (() => {
  const problem = new ProblemProvider();

  return [
    languages.registerCodeActionsProvider('po', problem),
    languages.registerDocumentSemanticTokensProvider('po', problem, legend),
  ];
}) as ExtensionModule;
