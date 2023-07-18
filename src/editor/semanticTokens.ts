/* eslint-disable @typescript-eslint/naming-convention */
import {
  DocumentSemanticTokensProvider,
  ProviderResult,
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  TextDocument,
  languages,
} from 'vscode';

import { ExtensionModule } from '../utils';
import { POData } from '../core/parse';

const legend = new SemanticTokensLegend([
  'po-auto-format-placeholder',
  'po-auto-storage-format',
]);

export class SemanticTokensProvider implements DocumentSemanticTokensProvider {
  provideDocumentSemanticTokens(
    document: TextDocument
  ): ProviderResult<SemanticTokens> {
    const tokensBuilder = new SemanticTokensBuilder(legend);

    POData.getStaticDocuments(document).items.forEach(
      ({ options: { msgid, msgstr, msgidPlural }, formatRegex }) => {
        for (const d of [msgid, msgstr, msgidPlural]) {
          if (!d) continue;

          for (const { range, value } of d) {
            const { character, line } = range.start;
            [...value.matchAll(formatRegex)]
              .map((d) => ({
                index: character + (d.index || 0),
                match: d[0],
                groups: d.groups,
              }))
              .forEach(({ match, index, groups: { arg } = {} }) => {
                if (!arg) {
                  tokensBuilder.push(line, index, match.length, 0);
                  return;
                }

                const name = match.slice(0, match.length - arg.length - 1);

                tokensBuilder.push(line, index, name.length, 0);
                tokensBuilder.push(line, index + name.length, arg.length, 1);
                tokensBuilder.push(
                  line,
                  index + name.length + arg.length,
                  match.length - name.length - arg.length,
                  0
                );
              });
          }
        }
      }
    );

    return tokensBuilder.build();
  }
}

export default (() => {
  return [
    languages.registerDocumentSemanticTokensProvider(
      'po',
      new SemanticTokensProvider(),
      legend
    ),
  ];
}) as ExtensionModule;
