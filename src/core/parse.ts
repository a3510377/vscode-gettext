import {
  Diagnostic,
  DiagnosticSeverity,
  EventEmitter,
  Range,
  TextDocument,
  languages,
  workspace,
} from 'vscode';

import { summonDiagnostic } from '../editor/problemsMessage';
import { langFormat } from './formatData';
import { orRegexp } from '../utils';

const exts = ['.po', '.pot'].map((ext) => ext.replace(/^\./, '')).join(',');

/** flag >> #, */
export const PREFIX_FLAGS = /^#, */;
/** extracted-comments >> #. */
export const PREFIX_AUTO_COMMENTS = /^#\./;
/** reference >> #: */
export const PREFIX_REFERENCES = /^#: */;
/** previous-untranslated >> #| */
export const PREFIX_PREV = /^#\|/;
/** translator-comments >> # */
export const PREFIX_COMMENTS = /^# */;
/** context >> msgctxt */
export const PREFIX_MSGCTXT = /^msgctxt +"/;
/** untranslated-string >> msgid */
export const PREFIX_MSGID = /^msgid +"/;
/** untranslated-string-plural >> msgid_plural */
export const PREFIX_MSGID_PLURAL = /^msgid_plural +"/;
/** translated-string >> msgstr */
export const PREFIX_MSGSTR = /^msgstr +"/;
/** translated-string-case-n >> msgstr[ */
export const PREFIX_MSGSTR_PLURAL = /^msgstr\[/;

export class POParser {
  constructor(public document: TextDocument) {}
  items: POItem[] = [];

  parse(): Diagnostic[] {
    const errors: Diagnostic[] = [];
    const items: POItem[] = [];
    let tmpOption: POItemOption = {};

    for (let i = 0; i < this.document.lineCount; i++) {
      const { text } = this.document.lineAt(i);

      /** get from offset to end PosData */
      const getValue = (offset = 0, match = /(.*)/): PosData | undefined => {
        const { text } = this.document.lineAt(i);
        const baseValue = text.slice(offset).trimEnd();
        const startPos = text.length - baseValue.length;
        const value = baseValue.match(match)?.[1];

        if (value) {
          return {
            value,
            endLine: i,
            statLine: i,
            range: new Range(i, startPos, i, startPos + value.length),
          };
        }
      };
      /** get from offset to end text data PosData */
      const getText = (offset = 0) => getValue(offset, /(.*)(?<!\\)"/);
      /** get multi-line text PosData */
      const getDeepText = (): PosData[] => {
        const tmp: PosData[] = [];

        for (i++; i < this.document.lineCount; i++) {
          const { text } = this.document.lineAt(i);
          const data = text.match(/^[ \t]*"/);

          if (!data) break;

          const t = getText(data[0].length);
          t && tmp.push(t);
        }
        i--;

        return tmp;
      };
      /** get now line and next multi-line text PosData */
      const getNowAndDeepText = (offset = 0) => {
        const t = getText(offset);
        return t ? [t, ...getDeepText()] : getDeepText();
      };
      /** get offset from regex */
      const getOffset = (regex: RegExp, value?: string) => {
        return (value || text).match(regex)?.[0].length || 0;
      };

      // flag >> #,
      if (PREFIX_FLAGS.test(text)) {
        const offset = getOffset(PREFIX_FLAGS);
        const tmp = getValue(offset);
        if (!tmp) continue;

        tmpOption.flags ||= {};
        for (const flag of `,${tmp.value}`.matchAll(/(\G|, *)([\w-]+)/g)) {
          const [, split, key] = flag;
          const tmpCheck = tmpOption.flags[key];
          const start = offset + (flag.index || 0) + split.length - 1;
          const data: PosData = {
            range: new Range(i, start, i, start + key.length),
            endLine: i,
            statLine: i,
            value: key,
          };

          tmpOption.flags[key] ||= [];
          tmpOption.flags[key].push(data);

          if (tmpCheck) {
            errors.push(
              summonDiagnostic('F003', data.range, DiagnosticSeverity.Warning, {
                key,
              })
            );
          }
        }
      } // extracted-comments >> #.
      else if (PREFIX_AUTO_COMMENTS.test(text)) {
        // const tmp = getValue(updateOffset(PREFIX_AUTO_COMMENTS));
      } // reference >> #:
      else if (PREFIX_REFERENCES.test(text)) {
        const offset = getOffset(PREFIX_REFERENCES);
        const tmp = getValue(offset);
        if (!tmp) continue;

        tmpOption.references ||= {};
        for (const reference of tmp.value.matchAll(/\S+:[\d;]*/g)) {
          const [key] = reference;
          const tmpCheck = tmpOption.references[key];
          const start = offset + (reference.index || 0);
          const data: PosData = {
            range: new Range(i, start, i, start + key.length),
            endLine: i,
            statLine: i,
            value: key,
          };

          tmpOption.references[key] ||= [];
          tmpOption.references[key].push(data);

          if (tmpCheck) {
            errors.push(
              summonDiagnostic('F004', data.range, DiagnosticSeverity.Warning, {
                key,
              })
            );
          }
        }
      } // previous-untranslated >> #|
      else if (PREFIX_PREV.test(text)) {
        // const tmp = getValue(updateOffset(PREFIX_PREV));
      } // translator-comments >> #
      else if (PREFIX_COMMENTS.test(text)) {
        const tmp = getValue(getOffset(PREFIX_COMMENTS));

        tmpOption.comments ||= [];
        tmp && tmpOption.comments.push(tmp);
      } // context >> msgctxt
      else if (PREFIX_MSGCTXT.test(text)) {
        tmpOption.msgctxt = getNowAndDeepText(getOffset(PREFIX_MSGCTXT));
      } // untranslated-string >> msgid
      else if (PREFIX_MSGID.test(text)) {
        tmpOption.msgid = getNowAndDeepText(getOffset(PREFIX_MSGID));
      } // untranslated-string-plural >> msgid_plural
      else if (PREFIX_MSGID_PLURAL.test(text)) {
        tmpOption.msgidPlural = getNowAndDeepText(
          getOffset(PREFIX_MSGID_PLURAL)
        );
      } // translated-string >> msgstr
      else if (PREFIX_MSGSTR.test(text)) {
        tmpOption.msgstr = getNowAndDeepText(getOffset(PREFIX_MSGSTR));

        items.push(new POItem(tmpOption));
        tmpOption = {};
      } // translated-string-case-n >> msgstr[
      else if (PREFIX_MSGSTR_PLURAL.test(text)) {
        getNowAndDeepText(getOffset(PREFIX_MSGSTR_PLURAL));
      } else {
        if (!text.trim()) continue;

        // TODO add error message
        tmpOption = {};
      }
    }

    this.items = items;

    return errors;
  }
}

export interface PosData<T = string> {
  value: T;
  statLine: number;
  endLine: number;
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

    workspace.onDidChangeTextDocument(({ document }) => {
      this.getStaticDocuments(document);
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

export interface POItemOption {
  comments?: PosData[];
  flags?: { [key: string]: PosData[] };
  references?: { [key: string]: PosData[] };
  msgctxt?: PosData[];
  msgidPlural?: PosData[];
  msgid?: PosData[];
  msgstr?: PosData[];
  msgstrPlural?: PosData[][];
}

export class POItem {
  public comments: string[];
  public flags: string[];
  public references: string[];
  public msgctxt?: string;
  public msgidPlural?: string;
  public msgid?: string;
  public msgstr?: string;
  public msgstrPlural?: string[];
  public formatRegex = langFormat.python;

  constructor(public options: POItemOption) {
    this.comments = options.comments?.map(({ value }) => value) || [];
    this.flags = Object.keys(options.flags || {});
    this.references = Object.keys(options.references || {});

    const parseString = (data?: PosData[]) => {
      return data?.map(({ value }) => value).join('');
    };

    this.msgctxt = parseString(options.msgctxt);
    this.msgidPlural = parseString(options.msgidPlural);
    this.msgid = parseString(options.msgid);
    this.msgstr = parseString(options.msgstr);
    this.msgstrPlural = options.msgstrPlural?.map((d) =>
      d.map(({ value }) => value).join('')
    );

    const regex = Object.keys(options.flags || {})
      .map((d) => d.replace(/-format$/, ''))
      .map((d) => langFormat[d as keyof typeof langFormat])
      .filter(Boolean);

    if (regex.length) this.formatRegex = orRegexp('g', ...regex);
  }
}
