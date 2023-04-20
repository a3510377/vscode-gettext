/* eslint-disable @typescript-eslint/naming-convention */
import {
  CodeAction,
  CodeActionKind,
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  ExtensionContext,
  Position,
  Range,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  TextDocument,
  WorkspaceEdit,
  languages,
  workspace,
} from 'vscode';
import {
  ErrorCodeMessageKeys,
  ErrorDataType,
  summonDiagnostic,
} from './error_message';
import { extract } from './utils';
import { langFormat } from './format-data';

export const PREFIX_EXTRACTED_COMMENTS = '#. ';
export const PREFIX_REFERENCES = '#: ';
export const PREFIX_FLAGS = '#, ';
// export const PREFIX_PREV_MSGID = '#| msgid';
export const PREFIX_MSGCTXT = 'msgctxt "';
export const PREFIX_MSGID = 'msgid "';
export const PREFIX_MSGID_PLURAL = 'msgid_plural "';
export const PREFIX_MSGSTR = 'msgstr "';
export const PREFIX_MSGSTR_PLURAL = 'msgstr[';
export const PREFIX_DELETED = '#~';
export const PREFIX_DELETED_MSGID = '#~ msgid';

const legend = new SemanticTokensLegend([
  'po-auto-format-placeholder',
  'po-auto-storage-format',
]);

type Optional<T = string> = T | undefined;
export const parse = (
  diagnostic: DiagnosticCollection | undefined,
  tokenBuild: SemanticTokensBuilder | undefined,
  document: TextDocument
) => {
  const errors: Diagnostic[] = [];

  type PosData = {
    value: string;
    startLine: number;
    endLine: number;
    endPos: number;
  };

  let msgidPlural: Optional<PosData[]>,
    msgid: Optional<PosData[]>,
    msgctxt: Optional<PosData[]>;
  let msgidN = NaN;
  let headers: Optional<Record<string, string>>;
  let nowFlags: Optional<RegExp>;

  const isEmpty = (data?: PosData[], strict = true) => {
    if (!data) return true;

    for (const item of data) return strict ? item.value === '' : false;
    return true;
  };

  const totalCount = document.lineCount;
  for (let i = 0; i < document.lineCount; i++) {
    let line = document.lineAt(i).text;

    const getDeep = (split?: string) => {
      const data: PosData[] = [];

      let tmp = '';
      let startLine = 0;
      for (; i < totalCount - 1; i++) {
        let line = document.lineAt(i + 1).text;

        if (/^\t?"|"^/.test(line)) {
          if (split === void 0) {
            data.push({
              value: extract(line),
              startLine: i,
              endLine: i,
              endPos: line.length,
            });
          } else if (line.includes(split)) {
            let startIndex = 0;
            for (
              let splitIndex = line.indexOf(split);
              splitIndex !== -1;
              splitIndex = line.indexOf(split)
            ) {
              tmp += line.slice(startIndex, splitIndex).replace(/^"|"$/, '');

              data.push({
                value: extract(tmp),
                startLine,
                endLine: i,
                endPos: splitIndex,
              });

              tmp = '';
              startLine = i;
              startIndex = splitIndex + split.length;
              line = line.slice(startIndex);
            }

            if (line) tmp += line.replace(/^"|"$/, '');
          } else tmp += line.replace(/^"|"$/, '');
        } else break;
      }

      return data;
    };

    const nowAndDeep = (split?: string) => {
      return [
        { value: extract(line), startLine: i, endLine: i, endPos: line.length },
        ...getDeep(split),
      ];
    };

    // extracted-comments (#. )
    if (line.startsWith(PREFIX_EXTRACTED_COMMENTS)) {
    }
    // reference (#: )
    else if (line.startsWith(PREFIX_REFERENCES)) {
    }
    // flag (#, )
    else if (line.startsWith(PREFIX_FLAGS)) {
      const flags = line
        .replace(/^#,/, '')
        .trim()
        .split(',')
        .map((flag) => flag.replace(/-format$/, ''));

      nowFlags = void 0;
      for (let flag of flags) {
        if (flag.startsWith('no-')) continue;

        if (flag in langFormat) {
          nowFlags = langFormat[flag as keyof typeof langFormat];
          break;
        }
      }
    }
    // context (msgctxt ")
    else if (line.startsWith(PREFIX_MSGCTXT)) msgctxt = nowAndDeep();
    // untranslated-string (msgid ")
    else if (line.startsWith(PREFIX_MSGID)) msgid = nowAndDeep();
    // untranslated-string-plural (msgid_plural ")
    else if (line.startsWith(PREFIX_MSGID_PLURAL)) msgidPlural = nowAndDeep();
    // translated-string (msgstr ")
    else if (line.startsWith(PREFIX_MSGSTR)) {
      if (msgidPlural) {
        // msgid_plural "test"
        // msgstr "test"
        errors.push(
          summonDiagnostic(
            'S001',
            new Range(new Position(i, 0), new Position(i, line.length))
          )
        );
      }

      if (isEmpty(msgid) && isEmpty(msgidPlural) && isEmpty(msgctxt)) {
        if (headers) {
          nowAndDeep();

          errors.push(
            summonDiagnostic(
              'F001',
              new Range(
                (msgid || msgidPlural || msgctxt)?.[0].startLine || i,
                0,
                i + 1,
                line.length
              ),
              DiagnosticSeverity.Warning
            )
          );
        } else {
          nowAndDeep('\\n').forEach(({ value, startLine, endLine, endPos }) => {
            if (!value) return;

            let [key, ...tmp] = value.split(':');

            headers ||= {};
            if (key in headers) {
              errors.push(
                summonDiagnostic(
                  'F002',
                  new Range(startLine + 2, 0, endLine + 1, endPos + 3),
                  DiagnosticSeverity.Warning
                )
              );
            } else headers[key] = tmp.join(':').trim();
          });
        }
      }

      msgidPlural = msgid = msgctxt = void 0;
    }
    // translated-string-case-N (msgstr[)
    else if (line.startsWith(PREFIX_MSGSTR_PLURAL)) {
      if (!msgidPlural) {
        errors.push(summonDiagnostic('S003', new Range(i, 0, i, line.length)));
      } else {
        let S002 = false;
        const strID = line.match(/msgstr\[(\d+)\]/)?.[1];

        if (!strID) S002 = true;
        else {
          const numberID = +strID;

          // numberID not in range
          if (numberID < 0) S002 = true;
          // numberID !== 0 && id is first
          else if (numberID && Number.isNaN(msgidN)) S002 = true;
          else {
            msgidN = Number.isNaN(msgidN) ? -1 : msgidN;

            // numberID !== old msgid next
            if (numberID !== ++msgidN) S002 = true;
          }
        }

        if (S002) {
          errors.push(
            summonDiagnostic('S002', new Range(i, 0, i, line.length), void 0, {
              nextID: msgidN,
            })
          );
        }
      }
    }
    // reset msgidPlural and else data
    else if (!line.startsWith(PREFIX_MSGSTR_PLURAL)) {
      msgidN = NaN;
      msgidPlural = msgid = msgctxt = void 0;
    }

    if (/^(msg(id|str))/.test(line)) {
      [...line.matchAll(new RegExp((nowFlags || langFormat.c).source, 'g'))]
        .map((d) => ({
          index: d.index || 0,
          match: d[0],
          groups: d.groups,
        }))
        .forEach(({ match, index, groups: { arg } = {} }) => {
          if (!arg) {
            tokenBuild?.push(i, index, match.length, 0);
            return;
          }

          const name = match.slice(0, match.length - arg.length - 1);

          tokenBuild?.push(i, index, name.length, 0);
          tokenBuild?.push(i, index + name.length, arg.length, 1);
          tokenBuild?.push(
            i,
            index + name.length + arg.length,
            match.length - name.length - arg.length,
            0
          );
        });
    }

    // (#~)
    // PREFIX_DELETED;
    // (#~ msgid)
    // PREFIX_DELETED_MSGID;
  }

  diagnostic?.set(document.uri, errors);
};

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
};

export function errorHandler(ctx: ExtensionContext) {
  const diagnostic = languages.createDiagnosticCollection('po');

  const exts = ['.po', '.pot'].map((ext) => ext.replace(/^\./, '')).join(',');

  workspace.findFiles(`**/*.{${exts}}`).then((paths) => {
    paths.forEach((path) => {
      workspace
        .openTextDocument(path)
        .then(parse.bind(null, diagnostic, void 0));
    });
  });

  workspace.onDidChangeTextDocument((d) =>
    parse(diagnostic, void 0, d.document)
  );

  ctx.subscriptions.push(
    languages.registerCodeActionsProvider('po', {
      provideCodeActions(document) {
        const actions: CodeAction[] = [];
        for (const diagnostic of languages.getDiagnostics(document.uri)) {
          const errorData = diagnostic.code as ErrorDataType;
          const errorCode = errorData.value;

          if (errorCode in errorsHandler && errorsHandler[errorCode]) {
            const quickFix = new CodeAction(
              `修復 ${errorCode}`,
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

          parse(void 0, tokensBuilder, document);

          return tokensBuilder.build();
        },
      },
      legend
    )
  );
}
