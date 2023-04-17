/* eslint-disable @typescript-eslint/naming-convention */

import { Diagnostic, DiagnosticSeverity, Range, Uri } from 'vscode';

export const BASE_WIKI =
  'https://github.com/a3510377/vscode-gettext/wiki/error-code';

export enum ErrorCodeMessage {
  // Syntax error
  S001 = 'Syntax error, expected msgstr[N] instead of msgstr "" due to previous occurrence of `msgid_plural`',
  S002 = 'Plural format has wrong index',
  S003 = 'Does not include msgid_plural but uses msgstr[N]',

  F001 = 'duplicate definition headers',
  F002 = 'same header name',
}

export type ErrorCodeMessageKeys = keyof typeof ErrorCodeMessage;

export const summonErrorLink = (ID: ErrorCodeMessageKeys) => {
  return {
    value: ID,
    target: Uri.parse(`${BASE_WIKI}#${ID}`),
    message: ErrorCodeMessage[ID as ErrorCodeMessageKeys],
  };
};

export const summonDiagnostic = (
  ID: ErrorCodeMessageKeys,
  range: Range,
  severity?: DiagnosticSeverity
): Diagnostic => {
  const error = summonErrorLink(ID);
  const d = new Diagnostic(range, error.message, severity);

  d.source = 'vscode-gettext';
  d.code = error;

  return d;
};
