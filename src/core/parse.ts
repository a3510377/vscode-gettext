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

  parse(): Diagnostic[] {
    const errors: Diagnostic[] = [];
    // const items: (POItem | undefined)[] = [];

    for (let i = 0; i < this.document.lineCount; i++) {
      const { text } = this.document.lineAt(i);
      let tmpOption: POItemOption = {};

      const getValue = (offset = 0, match = /(.*)/): PosData | undefined => {
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
      const getText = (offset: number = 0) => getValue(offset, /(.*)(?<!\\)"/);
      // const getDeepText = (): PosData => {};
      const updateOffset = (regex: RegExp, value?: string) => {
        return (value || text).match(regex)?.[0].length || 0;
      };

      // flag >> #,
      if (PREFIX_FLAGS.test(text)) {
        const offset = updateOffset(PREFIX_FLAGS);
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
        // TODO add extracted-comment
        // const tmp = getValue(updateOffset(PREFIX_AUTO_COMMENTS));
      } // reference >> #:
      else if (PREFIX_REFERENCES.test(text)) {
        const offset = updateOffset(PREFIX_REFERENCES);
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
        const tmp = getValue(updateOffset(PREFIX_COMMENTS));

        tmpOption.comments ||= [];
        tmp && tmpOption.comments.push(tmp);
      } // context >> msgctxt
      else if (PREFIX_MSGCTXT.test(text)) {
        getText(updateOffset(PREFIX_MSGCTXT));
      } // untranslated-string >> msgid
      else if (PREFIX_MSGID.test(text)) {
        getText(updateOffset(PREFIX_MSGID));
      } // untranslated-string-plural >> msgid_plural
      else if (PREFIX_MSGID_PLURAL.test(text)) {
        getText(updateOffset(PREFIX_MSGID_PLURAL));
      } // translated-string >> msgstr
      else if (PREFIX_MSGSTR.test(text)) {
        getText(updateOffset(PREFIX_MSGSTR));
        tmpOption = {};
      } // translated-string-case-n >> msgstr[
      else if (PREFIX_MSGSTR_PLURAL.test(text)) {
        getText(updateOffset(PREFIX_MSGSTR_PLURAL));
      } else {
        // TODO add error message
        tmpOption = {};
      }
    }

    console.log(errors);

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

  constructor(public option: POItemOption) {
    this.comments = option.comments?.map(({ value }) => value) || [];
    this.flags = Object.keys(option.flags || {});
    this.references = Object.keys(option.references || {});

    const parseString = (data?: PosData[]) => {
      return data?.map(({ value }) => value).join('');
    };

    this.msgctxt = parseString(option.msgctxt);
    this.msgidPlural = parseString(option.msgidPlural);
    this.msgid = parseString(option.msgid);
    this.msgstr = parseString(option.msgstr);
    this.msgstrPlural = option.msgstrPlural?.map((d) =>
      d.map(({ value }) => value).join('')
    );
  }
}
