/* eslint-disable @typescript-eslint/naming-convention */

import { Diagnostic, DiagnosticSeverity, Range, Uri } from 'vscode';

export const BASE_WIKI =
  'https://github.com/a3510377/vscode-gettext/wiki/error-code';

export enum ErrorCodeMessage {
  // Syntax error
  S001 = 'Syntax error, expected msgstr[N] instead of msgstr "" due to previous occurrence of `msgid_plural`',

  /** msgstr[N] 之 N 與上組不連貫 */
  S002 = '複數格式含有錯誤的索引',

  F001 = '重複定義 headers',
  F002 = '相同的 header name',
}

export const summonErrorLink = (ID: keyof typeof ErrorCodeMessage) => {
  return {
    value: ID,
    target: Uri.parse(`${BASE_WIKI}#${ID}`),
    message: ErrorCodeMessage[ID as keyof typeof ErrorCodeMessage],
  };
};

export const summonDiagnostic = (
  ID: keyof typeof ErrorCodeMessage,
  range: Range,
  severity?: DiagnosticSeverity
): Diagnostic => {
  const error = summonErrorLink(ID);
  const d = new Diagnostic(range, error.message, severity);

  d.source = 'vscode-gettext';
  d.code = error;

  return d;
};
