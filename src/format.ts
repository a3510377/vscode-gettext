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

import { langFormat } from './format-data';
import { match } from './utils';

const legend = new SemanticTokensLegend([
  'po-auto-format-placeholder',
  'po-auto-storage-format',
]);

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
