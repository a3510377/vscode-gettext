import {
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  ExtensionContext,
  Position,
  ProviderResult,
  Range,
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  TextDocument,
  languages,
  DocumentSemanticTokensProvider as vscodeDocumentSemanticTokensProvider,
  workspace,
} from 'vscode';

import { langFormat } from './format-data';
import { match } from './utils';

const legend = new SemanticTokensLegend([
  'po-auto-format-placeholder',
  'po-auto-storage-format',
]);

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

const provider: vscodeDocumentSemanticTokensProvider = {
  provideDocumentSemanticTokens(
    document: TextDocument
  ): ProviderResult<SemanticTokens> {
    const tokensBuilder = new SemanticTokensBuilder(legend);
    const content = document.getText();

    let nowFlags: RegExp | undefined,
      isContent: boolean = false;
    for (const [lineIndex, line] of Object.entries(
      content.split(/\r\n|\r|\n/)
    )) {
      // Flags
      // https://www.gnu.org/software/gettext/manual/html_node/PO-Files.html
      if (line.startsWith('#,')) {
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
        // msgid | msgid_plural | msgstr
      } else if (/^(msg(id|str))/.test(line) || isContent) {
        isContent = !line.trim().startsWith('\n');

        const d = extract(line);
        const offset = line.length - d.length - 1;

        match(nowFlags || langFormat.c, d).forEach(
          ({ match, index, groups: { arg } = {} }) => {
            const baseOffset = index + offset;

            if (!arg) {
              tokensBuilder.push(+lineIndex, baseOffset, match.length, 0);
              return;
            }

            const name = match.slice(0, match.length - arg.length - 1);

            tokensBuilder.push(+lineIndex, baseOffset, name.length, 0);
            tokensBuilder.push(
              +lineIndex,
              baseOffset + name.length,
              arg.length,
              1
            );
            tokensBuilder.push(
              +lineIndex,
              baseOffset + name.length + arg.length,
              match.length - name.length - arg.length,
              0
            );
          }
        );
      }
    }

    return tokensBuilder.build();
  },
};

const extractPos = (data: string) => {
  let pos = {};

  // for (let [index, value] of Object.entries(data)) {
  //   pos;
  //   // (+index);
  // }
};

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
  let dummy = '',
    startPos = NaN;

  let msgidPlural: Optional;

  const totalCount = document.lineCount;
  for (let i = 0; i < document.lineCount; i++) {
    let line = document.lineAt(i).text;

    const getDeep = (start: string = '"', end: string = '"') => {
      let data = '';
      for (; i < totalCount; i++) {
        line = document.lineAt(i + 1).text;

        if (line.startsWith('\t')) line = line.substring(1);
        if (line.startsWith(start) && line.endsWith(end)) data += extract(line);
        else break;
      }

      return data || void 0;
    };

    const extractNowAndDeep = (start: string = '"', end: string = '"') => {
      return extract(line) + (getDeep(start, end) || '');
    };

    const startWith = (start: string, base: string = line): boolean => {
      if (!base.startsWith(start)) return false;

      dummy = base.slice(start.length).trimEnd();
      return true;
    };

    // console.log(`${line}\n${extractPos(line)}\n-----`);
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
    else if (startWith(PREFIX_MSGCTXT)) {
    }
    // untranslated-string (msgid ")
    else if (startWith(PREFIX_MSGID)) {
    }
    // untranslated-string-plural (msgid_plural ")
    else if (startWith(PREFIX_MSGID_PLURAL)) {
      msgidPlural = extractNowAndDeep();
    }

    // translated-string (msgstr ")
    else if (startWith(PREFIX_MSGSTR)) {
      if (msgidPlural) {
        errors.push(
          new Diagnostic(
            new Range(new Position(i, 0), new Position(i, line.length)),
            'test',
            DiagnosticSeverity.Error
          )
        );
      }

      msgidPlural = void 0;
    }
    // translated-string-case-N (msgstr[)
    else if (PREFIX_MSGSTR_PLURAL) {
      msgidPlural = void 0;
    }

    // (#~)
    PREFIX_DELETED;
    // (#~ msgid)
    PREFIX_DELETED_MSGID;
  }

  diagnostic.set(document.uri, errors);
};

export function formatString(ctx: ExtensionContext) {
  ctx.subscriptions.push();

  const diagnostic = languages.createDiagnosticCollection('po');
  const exts = ['.po', '.pot'].map((ext) => ext.replace(/^\./, '')).join(',');

  workspace.findFiles(`**/*.{${exts}}`).then((paths) => {
    paths.forEach((path) => {
      workspace.openTextDocument(path).then(f.bind(null, diagnostic));
    });
  });
}
