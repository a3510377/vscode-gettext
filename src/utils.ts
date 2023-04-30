import { Disposable, ExtensionContext } from 'vscode';

export const orRegexp = (flags?: string, ...regexps: RegExp[]) => {
  return new RegExp(regexps.map((r) => `(?:${r.source})`, flags).join('|'));
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

/*
  unicode bar
  Reference from https://github.com/Changaco/unicode-progress-bars
*/

export const barStyles = [
  '▁▂▃▄▅▆▇█',
  '⣀⣄⣤⣦⣶⣷⣿',
  '⣀⣄⣆⣇⣧⣷⣿',
  '○◔◐◕⬤',
  '□◱◧▣■',
  '□◱▨▩■',
  '□◱▥▦■',
  '░▒▓█',
  '░█',
  '⬜⬛',
  '⬛⬜',
  '▱▰',
  '▭◼',
  '▯▮',
  '◯⬤',
  '⚪⚫',
];

export const unicodeProgressBar = (
  p: number,
  style = 8,
  minSize = 8,
  maxSize = 8
) => {
  const barStyle = barStyles[style];
  const fullSymbol = barStyle[barStyle.length - 1];
  const n = barStyle.length - 1;

  if (p === 100) return fullSymbol.repeat(maxSize);

  p /= 100;
  for (let i = maxSize; i >= minSize; i--) {
    const x = p * i;
    const full = Math.floor(x);
    let middle = Math.floor((x - full) * n);

    if (p !== 0 && full === 0 && middle === 0) middle = 1;

    if (
      Math.abs(p - (full + middle / n) / i) * 100 <
      Number.POSITIVE_INFINITY
    ) {
      return (
        fullSymbol.repeat(full) +
        (full === i ? '' : barStyle[middle]) +
        barStyle[0].repeat(i - full - 1)
      );
    }
  }
};
