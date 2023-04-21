import {
  Diagnostic,
  DiagnosticRelatedInformation,
  DiagnosticSeverity,
  Range,
  TextDocument,
} from 'vscode';
import { extract } from './utils';
import { summonDiagnostic as makeDiagnostic } from './error_message';

type Optional<T = string> = T | undefined;

export const PREFIX_EXTRACTED_COMMENTS = '#. ';
export const PREFIX_REFERENCES = '#: ';
export const PREFIX_FLAGS = '#, ';
// export const PREFIX_PREV_MSGID = '#| msgid';
export const PREFIX_MSGCTXT = 'msgctxt "';
export const PREFIX_MSGID = 'msgid "';
export const PREFIX_MSGID_PLURAL = 'msgid_plural "';
export const PREFIX_MSGSTR = 'msgstr "';
export const PREFIX_MSGSTR_PLURAL = 'msgstr[';
export const PREFIX_DELETED = '#~';
export const PREFIX_DELETED_MSGID = '#~ msgid';

export interface PosData<T = string> {
  value: T;
  startLine: number;
  endLine: number;
  endPos: number;
}

export class POParser {
  public items: POItem[] = [];
  public headers: Optional<Record<string, string>>;
  constructor(public document: TextDocument) {}

  public parse(): Diagnostic[] {
    const document = this.document;
    const errors: Diagnostic[] = [];

    let nowOption: POItemOption = {};
    let msgidN = NaN;

    const isEmpty = (data?: PosData[], strict = true) => {
      if (!data) return true;

      for (const item of data) return strict ? item.value === '' : false;
      return true;
    };

    const totalCount = document.lineCount;
    for (let i = 0; i < document.lineCount; i++) {
      let line = document.lineAt(i).text;

      /* ---- utils ---- */
      const getDeep = (split?: string) => {
        const data: PosData[] = [];

        let tmp = '';
        let startLine = 0;
        for (; i < totalCount - 1; i++) {
          let line = document.lineAt(i + 1).text;

          if (/^\t?"|"^/.test(line)) {
            if (split === void 0) {
              data.push({
                value: extract(line),
                startLine: i,
                endLine: i,
                endPos: line.length,
              });
            } else if (line.includes(split)) {
              let startIndex = 0;
              for (
                let splitIndex = line.indexOf(split);
                splitIndex !== -1;
                splitIndex = line.indexOf(split)
              ) {
                tmp += line.slice(startIndex, splitIndex).replace(/^"|"$/, '');

                data.push({
                  value: extract(tmp),
                  startLine,
                  endLine: i,
                  endPos: splitIndex,
                });

                tmp = '';
                startLine = i;
                startIndex = splitIndex + split.length;
                line = line.slice(startIndex);
              }

              if (line) tmp += line.replace(/^"|"$/, '');
            } else tmp += line.replace(/^"|"$/, '');
          } else break;
        }

        return data;
      };

      const nowAndDeep = (split?: string) => {
        return [
          {
            value: extract(line),
            startLine: i,
            endLine: i,
            endPos: line.length,
          },
          ...getDeep(split),
        ];
      };

      /* ---- base parse ---- */

      // extracted-comments (#. )
      if (line.startsWith(PREFIX_EXTRACTED_COMMENTS)) {
      }
      // reference (#: )
      else if (line.startsWith(PREFIX_REFERENCES)) {
      }
      // flag (#, )
      else if (line.startsWith(PREFIX_FLAGS)) {
        nowOption.flags = {
          value: line
            .replace(/^#,/, '')
            .trim()
            .split(',')
            .map((flag) => flag.replace(/-format$/, '')),
          startLine: i,
          endLine: i,
          endPos: line.length,
        };
      }
      // context (msgctxt ")
      else if (line.startsWith(PREFIX_MSGCTXT)) {
        nowOption.msgctxt = nowAndDeep();
      }
      // untranslated-string (msgid ")
      else if (line.startsWith(PREFIX_MSGID)) nowOption.msgid = nowAndDeep();
      // untranslated-string-plural (msgid_plural ")
      else if (line.startsWith(PREFIX_MSGID_PLURAL)) {
        nowOption.msgidPlural = nowAndDeep();
      }
      // translated-string (msgstr ")
      else if (line.startsWith(PREFIX_MSGSTR)) {
        const { msgid } = nowOption;

        if (nowOption.msgidPlural) {
          // msgid_plural "test"
          // msgstr "test"
          errors.push(makeDiagnostic('S001', new Range(i, 0, i, line.length)));
        } else if (
          isEmpty(msgid) &&
          isEmpty(nowOption.msgidPlural) &&
          isEmpty(nowOption.msgctxt)
        ) {
          if (this.headers) {
            nowAndDeep();

            errors.push(
              makeDiagnostic(
                'F001',
                new Range(
                  (msgid || nowOption.msgidPlural || nowOption.msgctxt)?.[0]
                    .startLine || i,
                  0,
                  i + 1,
                  line.length
                ),
                DiagnosticSeverity.Warning
              )
            );
          } else {
            nowAndDeep('\\n').forEach(
              ({ value, startLine, endLine, endPos }) => {
                if (!value) return;

                let [key, ...tmp] = value.split(':');

                this.headers ||= {};
                if (key in this.headers) {
                  errors.push(
                    makeDiagnostic(
                      'F002',
                      new Range(startLine + 2, 0, endLine + 1, endPos + 3),
                      DiagnosticSeverity.Warning
                    )
                  );
                } else this.headers[key] = tmp.join(':').trim();
              }
            );
          }
        } else if (msgid) {
          const { range, value } = postDataToRang(...msgid);
          const error = makeDiagnostic('S004', range);

          error.relatedInformation = this.items
            .map((item) => {
              if (value === item.msgid) {
                return {
                  message: `${item.msgid}: ${item.msgstr}`,
                  location: {
                    uri: document.uri,
                    range: postDataToRang(...(item.options.msgid as PosData[]))
                      .range,
                  },
                };
              }
            })
            .filter(Boolean) as DiagnosticRelatedInformation[];

          errors.push(error);

          nowOption.msgstr = nowAndDeep();
          this.items.push(new POItem(nowOption));
        } else {
          // TODO add error
        }

        nowOption = {};
      }
      // translated-string-case-N (msgstr[)
      else if (line.startsWith(PREFIX_MSGSTR_PLURAL)) {
        if (!nowOption.msgidPlural) {
          errors.push(makeDiagnostic('S003', new Range(i, 0, i, line.length)));
        } else {
          let S002 = false;
          const strID = line.match(/msgstr\[(\d+)\]/)?.[1];
          if (!strID) S002 = true;
          else {
            const numberID = +strID;

            // numberID not in range
            if (numberID < 0) S002 = true;
            // numberID !== 0 && id is first
            else if (numberID && Number.isNaN(msgidN)) S002 = true;
            else {
              msgidN = Number.isNaN(msgidN) ? -1 : msgidN;
              // numberID !== old msgid next
              if (numberID !== ++msgidN) S002 = true;
            }
          }
          if (S002) {
            errors.push(
              makeDiagnostic('S002', new Range(i, 0, i, line.length), void 0, {
                nextID: msgidN,
              })
            );
          } else {
            // TODO add msgstr[N]
            nowOption.msgstr = nowAndDeep();
          }
        }
      }
      // reset msgidPlural and else data
      else if (!line.startsWith(PREFIX_MSGSTR_PLURAL)) {
        if (!Number.isNaN(msgidN)) this.items.push(new POItem(nowOption));

        msgidN = NaN;
        nowOption = {};
      }
    }

    return errors;
  }
}

export interface POItemOption {
  msgid?: PosData[];
  flags?: PosData<string[]>;
  msgctxt?: PosData[];
  msgidPlural?: PosData[];
  msgstr?: PosData<string>[];
}

export class POItem {
  public msgid: string;
  public flags: string[];
  public msgstr: string;
  public msgctxt: string;
  public msgidPlural: string;

  constructor(public options: POItemOption) {
    const { msgid, msgctxt, msgidPlural, flags } = options;

    if (!msgid) throw new Error('msgid is required');

    this.msgid = postDataToRang(...msgid).value;
    this.flags =
      flags?.value.filter((now, i, data) => !data.includes(now, ++i)) || [];
    this.msgstr = postDataToRang(...msgid).value || '';

    this.msgctxt = postDataToRang(...(msgctxt || [])).value || '';
    this.msgidPlural = postDataToRang(...(msgidPlural || [])).value || '';
  }
}

const postDataToRang = (...data: PosData[]) => {
  const startLine = Math.min(...data.map((d) => d.startLine));
  const endLine = Math.max(...data.map((d) => d.endLine));
  const endPos = Math.max(
    ...data.filter((d) => d.endLine === endLine).map((d) => d.endPos)
  );

  return {
    value: data.map((p) => p.value).join(''),
    startLine,
    endLine,
    endPos,
    range: new Range(startLine, 0, endLine, endPos),
  };
};
