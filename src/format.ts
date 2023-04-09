/* eslint-disable @typescript-eslint/naming-convention */
import {
  ExtensionContext,
  ProviderResult,
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  TextDocument,
  languages,
  DocumentSemanticTokensProvider as vscodeDocumentSemanticTokensProvider,
} from 'vscode';

const legend = new SemanticTokensLegend([
  'po-auto-format-placeholder',
  'po-auto-storage-format',
]);

// majority reference: https://github.com/microsoft/vscode/tree/main/extensions
const langFormat: Record<string, RegExp> = {
  c: /%(\d+\$)?[#0\- +']*[,;:_]?((-?\d+)|\*(-?\d+\$)?)?(\.((-?\d+)|\*(-?\d+\$)?)?)?(hh|h|ll|l|j|t|z|q|L|vh|vl|v|hv|hl)?[diouxXDOUeEfFgGaACcSspn%]/g,

  // objc: //g,

  // https://docs.python.org/3/library/stdtypes.html#printf-style-string-formatting
  python: /%(\([\w\s]*\))?[#0+\- ]*[diouxXeEfFgGcrs%]/g,

  // https://peps.python.org/pep-3101/
  'python-brace':
    /{{|}}|({\w*(\.[[:alpha:]_]\w*|\[[^\]'"]+\])*(?<arg>(![rsa])?(:\w?[><=^]?[ +-]?#?\d*,?(\.\d+)?[bcdeEfFgGnosxX%]?))?})/g,

  // java: //g,
  // 'java-printf': //g,
  // csharp: //g,
  javascript: /%(\([\w\s]*\))?[#0+\- ]*[diouxXeEfFgGcrs%]/g,
  // scheme: //g,
  // lisp: //g,
  // elisp: //g,
  // librep: //g,
  // ruby: //g,
  // sh: //g,
  // awk: //g,
  // lua: //g,
  // 'object-pascal': //g,
  // smalltalk: //g,
  // qt: //g,
  // 'qt-plural': //g,
  // kde: //g,
  // boost: //g,
  // tcl: //g,
  // perl: //g,
  // 'perl-brace': //g,
  // php: //g,
  'gcc-internal':
    /(?!%')(?!%")%(\d+\$)?[#0\- +']*[,;:_]?((-?\d+)|\*(-?\d+\$)?)?(\.((-?\d+)|\*(-?\d+\$)?)?)?(hh|h|ll|l|j|t|z|q|L|vh|vl|v|hv|hl)?[diouxXDOUeEfFgGaACcSspn%]/g,
  // 'gfc-internal': //g,
  // ycp: //g,
};

const provider: vscodeDocumentSemanticTokensProvider = {
  provideDocumentSemanticTokens(
    document: TextDocument
  ): ProviderResult<SemanticTokens> {
    const tokensBuilder = new SemanticTokensBuilder(legend);
    const content = document.getText();

    let nowFlags: RegExp | undefined;
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
        for (const flag of flags) {
          if (flag.startsWith('no-')) continue;

          nowFlags = langFormat[flag];
          break;
        }
      } else if (line.startsWith('msgid')) {
        const d = extract(line);
        const offset = line.length - d.length - 1;
        if (!nowFlags) continue;

        match(nowFlags, d).forEach(({ match, index, groups: { arg } = {} }) => {
          const baseOffset = index + offset;

          if (arg) {
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
          } else tokensBuilder.push(+lineIndex, baseOffset, match.length, 0);
        });
      }
    }

    return tokensBuilder.build();
  },
};

const match = (re: RegExp, str: string) => {
  const data: {
    index: number;
    match: string;
    groups?: Record<string, string>;
  }[] = [];

  let match;
  while ((match = re.exec(str)) !== null) {
    data.push({
      index: match.index,
      match: match[0],
      groups: match.groups,
    });
  }

  return data;
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

export function formatString(ctx: ExtensionContext) {
  ctx.subscriptions.push(
    languages.registerDocumentSemanticTokensProvider('po', provider, legend)
  );
}
