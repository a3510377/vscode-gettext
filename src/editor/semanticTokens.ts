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

const legend = new SemanticTokensLegend([
  'po-auto-format-placeholder',
  'po-auto-storage-format',
]);

export class SemanticTokensProvider implements DocumentSemanticTokensProvider {
  provideDocumentSemanticTokens(
    document: TextDocument
  ): ProviderResult<SemanticTokens> {
    const tokensBuilder = new SemanticTokensBuilder(legend);

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
