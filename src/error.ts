import {
  CodeAction,
  CodeActionKind,
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  ExtensionContext,
  Position,
  Range,
  TextDocument,
  WorkspaceEdit,
  languages,
  workspace,
} from 'vscode';
import { summonDiagnostic } from './error_message';

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

const extract = (string: string) => {
  return string
    .trim()
    .replace(/^[^"]*"|"$/g, '')
    .replace(
      /\\([abtnvfr'"\\?]|([0-7]{3})|x([0-9a-fA-F]{2}))/g,
      (_, esc: string, oct: string, hex: string) => {
        if (oct) return String.fromCharCode(parseInt(oct, 8));
        if (hex) return String.fromCharCode(parseInt(hex, 16));

        return (
          {
            a: '\x07',
            b: '\b',
            t: '\t',
            n: '\n',
            v: '\v',
            f: '\f',
            r: '\r',
          }[esc] || esc
        );
      }
    );
};

type Optional<T = string> = T | undefined;
export const f = (diagnostic: DiagnosticCollection, document: TextDocument) => {
  const errors: Diagnostic[] = [];
  let dummy = '';

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

    const startWith = (start: string, base: string = line): boolean => {
      if (!base.startsWith(start)) return false;

      dummy = base.slice(start.length).trimEnd();
      return true;
    };

    // extracted-comments (#. )
    if (startWith(PREFIX_EXTRACTED_COMMENTS)) {
    }
    // reference (#: )
    else if (startWith(PREFIX_REFERENCES)) {
      // console.log(dummy);
    }
    // flag (#, )
    else if (startWith(PREFIX_FLAGS)) {
    }
    // context (msgctxt ")
    else if (startWith(PREFIX_MSGCTXT)) msgctxt = nowAndDeep();
    // untranslated-string (msgid ")
    else if (startWith(PREFIX_MSGID)) msgid = nowAndDeep();
    // untranslated-string-plural (msgid_plural ")
    else if (startWith(PREFIX_MSGID_PLURAL)) msgidPlural = nowAndDeep();
    // translated-string (msgstr ")
    else if (startWith(PREFIX_MSGSTR)) {
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

      if (isEmpty(msgid) || isEmpty(msgidPlural) || isEmpty(msgctxt)) {
        if (headers) {
          nowAndDeep();
          console.log(msgid);

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
            let data = tmp.join(':').trim();

            headers ||= {};
            if (key in headers) {
              errors.push(
                summonDiagnostic(
                  'F002',
                  new Range(startLine + 2, 0, endLine + 1, endPos + 3),
                  DiagnosticSeverity.Warning
                )
              );
            } else headers[key] = data;
          });
        }
      }

      msgidPlural = msgid = msgctxt = void 0;
    }
    // translated-string-case-N (msgstr[)
    else if (PREFIX_MSGSTR_PLURAL) {
      msgidPlural = msgid = msgctxt = void 0;
    }

    // (#~)
    PREFIX_DELETED;
    // (#~ msgid)
    PREFIX_DELETED_MSGID;
  }

  diagnostic.set(document.uri, errors);
};

export function errorHandler(ctx: ExtensionContext) {
  const diagnostic = languages.createDiagnosticCollection('po');

  const exts = ['.po', '.pot'].map((ext) => ext.replace(/^\./, '')).join(',');

  workspace.findFiles(`**/*.{${exts}}`).then((paths) => {
    paths.forEach((path) => {
      workspace.openTextDocument(path).then(f.bind(null, diagnostic));
    });
  });

  workspace.onDidChangeTextDocument((d) => f(diagnostic, d.document));

  ctx.subscriptions.push(
    languages.registerCodeActionsProvider('po', {
      provideCodeActions(document, range, context, token) {
        const actions: CodeAction[] = [];
        for (const diagnostic of languages.getDiagnostics(document.uri)) {
          const quickFix = new CodeAction('test', CodeActionKind.QuickFix);

          quickFix.isPreferred = true;
          quickFix.edit = new WorkspaceEdit();
          quickFix.edit.replace(document.uri, diagnostic.range, 'test');

          quickFix.diagnostics = [diagnostic];

          actions.push(quickFix);
        }
        return actions;
      },
    })
  );
}
