/* eslint-disable @typescript-eslint/naming-convention */
import {
  CodeAction,
  CodeActionKind,
  Diagnostic,
  ExtensionContext,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  TextDocument,
  WorkspaceEdit,
  languages,
  workspace,
} from 'vscode';

import { ErrorCodeMessageKeys, ErrorDataType } from './error_message';
import { POParser, postDataToRang, staticDocuments } from './parse';

const legend = new SemanticTokensLegend([
  'po-auto-format-placeholder',
  'po-auto-storage-format',
]);

const errorsHandler: Record<
  ErrorCodeMessageKeys,
  | ((
      document: TextDocument,
      editor: WorkspaceEdit,
      diagnostic: Diagnostic
    ) => void)
  | undefined
> = {
  F001: undefined,
  F002: undefined,

  S001(document, editor, diagnostic) {
    editor.replace(
      document.uri,
      diagnostic.range,
      document.getText(diagnostic.range).replace(/^(msgstr) (.*)/, `$1[0] $2`)
    );
  },
  S002(document, editor, diagnostic) {
    let errorData = diagnostic.code as ErrorDataType;

    editor.replace(
      document.uri,
      diagnostic.range,
      document
        .getText(diagnostic.range)
        .replace(/^(msgstr)\[\d+\] (.*)/, `$1[${errorData?.nextID || 0}] $2`)
    );
  },
  S003: undefined,
  S004: undefined,
};

export function errorHandler(ctx: ExtensionContext) {
  const diagnostic = languages.createDiagnosticCollection('po');
  const exts = ['.po', '.pot'].map((ext) => ext.replace(/^\./, '')).join(',');

  const setStaticDocuments = (document: TextDocument) => {
    const parser = staticDocuments[document.uri.path] || new POParser(document);

    staticDocuments[document.uri.path] ||= parser;
    diagnostic.set(document.uri, parser.parse());

    return parser;
  };

  workspace.findFiles(`**/*.{${exts}}`).then((paths) => {
    paths.forEach((path) => {
      if (!(path.path in staticDocuments)) {
        workspace
          .openTextDocument(path)
          .then((document) => setStaticDocuments(document));
      } else staticDocuments[path.path].parse();
    });
  });

  workspace.onDidChangeTextDocument((d) => setStaticDocuments(d.document));

  ctx.subscriptions.push(
    languages.registerCodeActionsProvider('po', {
      provideCodeActions(document) {
        const actions: CodeAction[] = [];
        for (const diagnostic of languages.getDiagnostics(document.uri)) {
          const errorData = diagnostic.code as ErrorDataType;
          const errorCode = errorData.value;

          if (errorCode in errorsHandler && errorsHandler[errorCode]) {
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
      },
    }),
    languages.registerDocumentSemanticTokensProvider(
      'po',
      {
        provideDocumentSemanticTokens(document) {
          const tokensBuilder = new SemanticTokensBuilder(legend);

          setStaticDocuments(document).items.forEach(
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
        },
      },
      legend
    )
  );
}
