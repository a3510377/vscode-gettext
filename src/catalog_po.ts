import fs from 'fs';
import path from 'path';

export const PREFIX_FLAGS = '#, ';
export const PREFIX_AUTOCOMMENTS = '#. ';
export const PREFIX_AUTOCOMMENTS2 = '#.';
export const PREFIX_REFERENCES = '#: ';
export const PREFIX_PREV_MSGID = '#| ';
export const PREFIX_MSGCTXT = 'msgctxt "';
export const PREFIX_MSGID = 'msgid "';
export const PREFIX_MSGID_PLURAL = 'msgid_plural "';
export const PREFIX_MSGSTR = 'msgstr "';
export const PREFIX_MSGSTR_PLURAL = 'msgstr[';
export const PREFIX_DELETED = '#~';
export const PREFIX_DELETED_MSGID = '#~ msgid';

export const parse = (content: string) => {
  const lines = content.split(/\r\n?|\n/);
  const comments: string[] = [];
  const references: string[] = [];
  const previousMsgid = [];
  const deletedLines = [];

  let dummy = '';
  let flags = '';
  let msgctxt = '';
  let msgid = '';
  let msgidPlural = '';
  let headers: Record<string, string> = {};
  const data = [];

  const startWith = (base: string, start: string): boolean => {
    if (!base.startsWith(start)) return false;

    dummy = base.slice(start.length).trimEnd();
    return true;
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    const getDeep = (start: string = '"', end: string = '"') => {
      let data = '';
      for (; i < lines.length; i++) {
        line = lines[i + 1];

        if (line.startsWith('\t')) line = line.substring(1);
        if (line.startsWith(start) && line.endsWith(end)) data += extract(line);
        else break;
      }

      return data || void 0;
    };

    const extractNowAndDeep = (start: string = '"', end: string = '"') => {
      return extract(line) + (getDeep(start, end) || '');
    };

    // flags
    if (startWith(line, PREFIX_FLAGS)) flags = dummy;
    // auto comments
    else if (
      startWith(line, PREFIX_AUTOCOMMENTS) ||
      startWith(line, PREFIX_AUTOCOMMENTS)
    ) {
      comments.push(dummy);
    }
    // references
    else if (startWith(line, PREFIX_REFERENCES)) references.push(dummy);
    // previous msgid value
    else if (startWith(line, PREFIX_PREV_MSGID)) previousMsgid.push(dummy);
    // msgctxt
    else if (startWith(line, PREFIX_MSGCTXT)) msgctxt = extractNowAndDeep();
    // msgid
    else if (startWith(line, PREFIX_MSGID)) msgid = extractNowAndDeep();
    // msgid_plural
    else if (startWith(line, PREFIX_MSGID_PLURAL)) {
      msgidPlural = extractNowAndDeep();
    }
    // msgstr
    else if (startWith(line, PREFIX_MSGSTR)) {
      if (msgidPlural) {
        // msgid_plural "test"
        // msgstr "test"
        throw new Error('singular form msgstr used together with msgid_plural');
      }

      // headers
      // check msgid, msgid_plural, msgctxt is empty
      if (!(msgid || msgidPlural || msgctxt)) {
        // check headers is empty
        // (headers are only defined at the beginning of the file and only once)
        if (!Object.keys(headers).length) {
          headers = Object.fromEntries(
            extractNowAndDeep()
              .split('\n')
              .map((d) => {
                const [name, ...value] = d.split(':');

                return [name.trim(), value.join(':').trim()];
              })
              .filter(([name, value]) => name && value)
          );
        }
      } else data.push({ flags, msgctxt, msgid, msgstr: extractNowAndDeep() });

      dummy = flags = msgctxt = msgid = msgidPlural = '';
    }
    // msgstr[i]
    else if (startWith(line, PREFIX_MSGSTR_PLURAL)) {
      let msgstrIndex = dummy.match(/(\d+)]/)?.[1];
      if (!msgstrIndex) throw new Error(`Invalid msgstr index, ${i + 1}`);

      const mMsgstr = [extractNowAndDeep()];

      for (; i < lines.length; i++) {
        line = lines[i + 1];

        if (line.startsWith('\t')) line = line.substring(1);
        if (line.startsWith(PREFIX_MSGSTR_PLURAL)) {
          msgstrIndex = line.match(/(\d+)]/)?.[1];

          // TODO add error message, if msgstrIndex is not set, throw exception instead
          if (!msgstrIndex) continue;
          // TODO add error message, if mMsgstr[msgstrIndex] is set, throw exception instead

          mMsgstr[+msgstrIndex] = extractNowAndDeep();
        } else break;
      }

      data.push({ flags, msgctxt, msgid, msgidPlural, mMsgstr });
      dummy = flags = msgctxt = msgid = msgidPlural = '';
    }
    // deleted lines
    else if (startWith(line, PREFIX_DELETED)) {
      deletedLines.push(dummy.trim());
    }
    // comment
    else if (line.startsWith('#')) {
    }
  }

  console.log(data, deletedLines);
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
            a: '\x07', // js no \a, so use \x07 instead
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

const content = fs.readFileSync(path.join(__dirname, '../test/test.po'));
parse(content.toString());
