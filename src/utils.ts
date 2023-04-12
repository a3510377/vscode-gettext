export const orRegexp = (flags?: string, ...regexps: RegExp[]) => {
  return new RegExp(regexps.map((r) => `(?:${r.source})`, flags).join('|'));
};

export const match = (re: RegExp, str: string) => {
  return [...str.matchAll(new RegExp(re.source, 'g'))].map((d) => ({
    index: d.index || 0,
    match: d[0],
    groups: d.groups,
  }));
};
