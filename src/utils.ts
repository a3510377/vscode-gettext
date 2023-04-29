import { Disposable, ExtensionContext } from 'vscode';

export const orRegexp = (flags?: string, ...regexps: RegExp[]) => {
  return new RegExp(regexps.map((r) => `(?:${r.source})`, flags).join('|'));
};

export const extract = (string: string) => {
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

export const flatten = <T>(...array: (ReadonlyArray<T> | T)[]): T[] => {
  const result: T[] = [];
  for (const value of array) {
    if (Array.isArray(value)) flatten(...value);
    else result.push(value as T);
  }

  return result;
};

export type ExtensionModule = (
  ctx: ExtensionContext
) => Disposable | Disposable[];
