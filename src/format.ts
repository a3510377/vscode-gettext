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
//                     https://github.com/vslavik/poedit
const langFormat: Record<string, RegExp> = {
  // old style https://docs.python.org/2/library/stdtypes.html#string-formatting
  // new style https://docs.python.org/3/library/string.html#format-string-syntax
  // ((%(\(\w+\))?[-+ #0]?(\d+|\*)?(\.(\d+|\*))?[hlL]?[diouxXeEfFgGcrs%]))|(\{[\w.-:,]+\})
  python: /%(\([\w\s]*\))?[#0+\- ]*[diouxXeEfFgGcrs%]/g,

  // https://peps.python.org/pep-3101/
  'python-brace':
    /{{|}}|({\w*(\.[[:alpha:]_]\w*|\[[^\]'"]+\])*(?<arg>(![rsa])?(:\w?[><=^]?[ +-]?#?\d*,?(\.\d+)?[bcdeEfFgGnosxX%]?))?})/g,

  javascript: /%(\([\w\s]*\))?[#0+\- ]*[diouxXeEfFgGcrs%]/g,

  /* ------------------------------------- */
  /* The following is correct confirmation */
  /* ------------------------------------- */

  // http://en.cppreference.com/w/cpp/io/c/fprintf,
  // http://pubs.opengroup.org/onlinepubs/9699919799/functions/fprintf.html
  // %(\d+\$)?[-+ #0]{0,5}(\d+|\*)?(\.(\d+|\*))?(hh|ll|[hljztL])?[%csdioxXufFeEaAgGnp])
  c: /%(\d+\$)?[#0\- +']*[,;:_]?((-?\d+)|\*(-?\d+\$)?)?(\.((-?\d+)|\*(-?\d+\$)?)?)?(hh|h|ll|l|j|t|z|q|L|vh|vl|v|hv|hl)?[diouxXDOUeEfFgGaACcSspn%]/g,

  // ruby-format per https://ruby-doc.org/core-2.7.1/Kernel.html#method-i-sprintf
  ruby: /(%(\d+\$)?[-+ #0]{0,5}(\d+|\*)?(\.(\d+|\*))?(hh|ll|[hljztL])?[%csdioxXufFeEaAgGnp])/g,

  // Lua
  lua: /(%[- 0]*\d*(\.\d+)?[sqdiouXxAaEefGgc])/g,

  // Pascal per https://www.freepascal.org/docs-html/rtl/sysutils/format.html
  'object-pascal':
    /(%(\*:|\d*:)?-?(\*|\d+)?(\.\*|\.\d+)?[dDuUxXeEfFgGnNmMsSpP])/g,

  // Qt and KDE formats
  qt: /(%L?(\d\d?|n))/g,
  kde: /(%L?(\d\d?|n))/g,

  // http://php.net/manual/en/function.sprintf.php
  php: /(%(\d+\$)?[-+]{0,2}([ 0]|'.)?-?\d*(\..?\d+)?[%bcdeEfFgGosuxX])/g,
  'gcc-internal':
    /(?!%')(?!%")%(\d+\$)?[#0\- +']*[,;:_]?((-?\d+)|\*(-?\d+\$)?)?(\.((-?\d+)|\*(-?\d+\$)?)?)?(hh|h|ll|l|j|t|z|q|L|vh|vl|v|hv|hl)?[diouxXDOUeEfFgGaACcSspn%]/g,

  // sh: //g,
  // awk: //g,
  // 'qt-plural': //g,
  // boost: //g,
  // tcl: //g,
  // perl: //g,
  // 'perl-brace': //g,
  // smalltalk: //g,
  // 'gfc-internal': //g,
  // ycp: //g,
  // scheme: //g,
  // lisp: //g,
  // elisp: //g,
  // librep: //g,
  // java: //g,
  // 'java-printf': //g,
  // csharp: //g,
  // objc: //g,
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
      } else if (/^(msg(id|str))/.test(line)) {
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
