import {
  Diagnostic,
  DiagnosticRelatedInformation,
  DiagnosticSeverity,
  Range,
  TextDocument,
  languages,
  workspace,
  EventEmitter,
} from 'vscode';

import { summonDiagnostic as makeDiagnostic } from '../editor/problems_message';
import { langFormat } from './format-data';
import path from 'path';

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

export const staticDocuments: Record<string, POParser> = {};

const exts = ['.po', '.pot'].map((ext) => ext.replace(/^\./, '')).join(',');

export interface PosData<T = string> {
  value: T;
  startLine: number;
  endLine: number;
  endPos: number;
}
export interface ParserPostData<T = string> extends PosData<T> {
  range: Range;
}

export class POData {
  static changeEvent = new EventEmitter<Record<string, POParser>>();
  static diagnostic = languages.createDiagnosticCollection('po');
  protected static _documents: Record<string, POParser> = {};

  static getStaticDocuments(document: TextDocument) {
    const parser = this._documents[document.uri.path] || new POParser(document);

    this._documents[document.uri.path] ||= parser;
    this.diagnostic.set(document.uri, parser.parse());

    return parser;
  }

  static get documents() {
    return this._documents;
  }

  static init() {
    workspace.findFiles(`**/*.{${exts}}`).then((paths) => {
      paths.forEach((path) => {
        if (!(path.path in this.documents)) {
          workspace.openTextDocument(path).then((document) => {
            this.getStaticDocuments(document);
          });
        } else this.documents[path.path].parse();
      });
    });

    workspace.onDidChangeTextDocument((d) => {
      this.getStaticDocuments(d.document);
    });
  }

  static clear() {
    this._documents = {};
    this.diagnostic.clear();
    this.refresh();
  }

  static refresh() {
    this.changeEvent.fire(this.documents);
  }
}

export class POParser {
  public items: POItem[] = [];
  public headers: Optional<Record<string, string>>;
  public errors: Diagnostic[] = [];
  protected _locale?: string;

  constructor(public document: TextDocument) {}

  get total() {
    return this.items.length;
  }
  get translated() {
    return this.items.filter((item) => {
      const check = (d: string) => d && d !== '';
      return (
        check(item.msgstr) ||
        item.msgstrPlural.filter(check).length === item.msgstrPlural.length
      );
    });
  }
  get missing() {
    return this.items.filter((item) => !item.msgstr);
  }
  get dict() {
    const map: Record<string, string | string[]> = {};

    this.items.forEach((item) => {
      if (!item.msgid) return;
      map[item.msgid] = item.msgstr || item.msgstrPlural;
    });

    return map;
  }
  get locale() {
    if (this._locale) return this._locale;

    return (
      this.headers?.['Language'] ||
      path.basename(this.document.fileName).replace(/\.[^\.]*$/, '')
    );
  }

  parse(): Diagnostic[] {
    const document = this.document;
    const errors: Diagnostic[] = [];
    const items: POItem[] = [];

    let headers: Optional<Record<string, string>>;

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
          value: line.replace(/^#,/, '').trim().split(','),
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
      else if (line.startsWith(PREFIX_MSGID)) {
        nowOption.msgid = nowAndDeep();
        const msgidData = postDataToRang(...(nowOption.msgid || []));
        if (!msgidData) continue;
        const { value, range } = msgidData;

        const relatedInformation: DiagnosticRelatedInformation[] = items
          .map(({ msgid, msgstr, options }) => {
            if (msgid === value) {
              return {
                message: `${msgid}: ${msgstr}`,
                location: {
                  uri: document.uri,
                  range: postDataToRang(...(options.msgid as PosData[]))?.range,
                },
              };
            }
          })
          .filter(Boolean) as DiagnosticRelatedInformation[];

        if (relatedInformation.length > 0) {
          const error = makeDiagnostic('S004', range);
          error.relatedInformation = relatedInformation;

          errors.push(error);
        }
      }
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
          if (headers) {
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

                headers ||= {};
                if (key in headers) {
                  errors.push(
                    makeDiagnostic(
                      'F002',
                      new Range(startLine + 2, 0, endLine + 1, endPos + 3),
                      DiagnosticSeverity.Warning
                    )
                  );
                } else headers[key] = tmp.join(':').trim();
              }
            );
          }
        } else {
          nowOption.msgstr = nowAndDeep();
          items.push(new POItem(nowOption));
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
            nowOption.msgstrPlural ||= [];
            nowOption.msgstrPlural[msgidN] = nowAndDeep();
          }
        }
      }
      // reset msgidPlural and else data
      else if (!line.startsWith(PREFIX_MSGSTR_PLURAL)) {
        if (!Number.isNaN(msgidN)) items.push(new POItem(nowOption));

        msgidN = NaN;
        nowOption = {};
      }
    }

    this.items = items;
    this.errors = errors;
    this.headers = headers;

    POData.refresh();
    return errors;
  }
}

export interface POItemOption {
  msgid?: PosData[];
  flags?: PosData<string[]>;
  msgctxt?: PosData[];
  msgidPlural?: PosData[];
  msgstr?: PosData<string>[];
  msgstrPlural?: PosData<string>[][];
}

export class POItem {
  public msgid: string;
  public flags: string[];
  public msgstr: string;
  public msgctxt: string;
  public msgidPlural: string;
  public msgstrPlural: string[];
  public formatRegex: RegExp = langFormat.c;

  constructor(public options: POItemOption) {
    const { msgid, msgstr, msgctxt, msgidPlural, flags, msgstrPlural } =
      options;

    if (!msgid) throw new Error('msgid is required');

    for (let flag of flags?.value?.map((flag) =>
      flag.replace(/-format$/, '')
    ) || []) {
      if (flag.startsWith('no-')) continue;

      if (flag in langFormat) {
        this.formatRegex = new RegExp(
          langFormat[flag as keyof typeof langFormat].source,
          'g'
        );
        break;
      }
    }

    this.msgid = postDataToRang(...msgid)?.value || '';
    this.flags =
      flags?.value.filter((now, i, data) => !data.includes(now, ++i)) || [];
    this.msgstr = postDataToRang(...(msgstr || []))?.value || '';

    this.msgctxt = postDataToRang(...(msgctxt || []))?.value || '';
    this.msgidPlural = postDataToRang(...(msgidPlural || []))?.value || '';
    this.msgstrPlural =
      msgstrPlural?.map((d) => postDataToRang(...d)?.value || '') || [];
  }
}

export const postDataToRang = (
  ...data: PosData[]
): ParserPostData | undefined => {
  if (data.length === 0) return;

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
