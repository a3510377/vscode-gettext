/* eslint-disable @typescript-eslint/naming-convention */
import {
  CodeAction,
  CodeActionKind,
  CodeActionProvider,
  Command,
  ProviderResult,
  TextDocument,
  WorkspaceEdit,
  languages,
} from 'vscode';

import { ErrorDataType, errorsHandler } from './problemsMessage';
import { ExtensionModule } from '../utils';

export class ProblemProvider implements CodeActionProvider {
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

  return [languages.registerCodeActionsProvider('po', problem)];
}) as ExtensionModule;
