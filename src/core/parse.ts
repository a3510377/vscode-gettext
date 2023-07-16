import {
  Diagnostic,
  EventEmitter,
  Range,
  TextDocument,
  languages,
  workspace,
} from 'vscode';

const exts = ['.po', '.pot'].map((ext) => ext.replace(/^\./, '')).join(',');

/** translator-comments >> # */
export const PREFIX_COMMENTS = /^#/;
/** flag >> #, */
export const PREFIX_FLAGS = /^#,/;
/** extracted-comments >> #. */
export const PREFIX_AUTO_COMMENTS = /^#./;
/** reference >> #: */
export const PREFIX_REFERENCES = /^#:/;
/** previous-untranslated >> #| */
export const PREFIX_PREV = /^#\|/;
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
    for (let i = 0; i < this.document.lineCount; i++) {
      const { text } = this.document.lineAt(i);

      // translator-comments >> #
      if (PREFIX_COMMENTS.test(text)) {
      } // flag >> #,
      else if (PREFIX_FLAGS.test(text)) {
      } // extracted-comments >> #.
      else if (PREFIX_AUTO_COMMENTS.test(text)) {
      } // reference >> #:
      else if (PREFIX_REFERENCES.test(text)) {
      } // previous-untranslated >> #|
      else if (PREFIX_PREV.test(text)) {
      } // context >> msgctxt
      else if (PREFIX_MSGCTXT.test(text)) {
      } // untranslated-string >> msgid
      else if (PREFIX_MSGID.test(text)) {
      } // untranslated-string-plural >> msgid_plural
      else if (PREFIX_MSGID_PLURAL.test(text)) {
      } // translated-string >> msgstr
      else if (PREFIX_MSGSTR.test(text)) {
      } // translated-string-case-n >> msgstr[
      else if (PREFIX_MSGSTR_PLURAL.test(text)) {
      }
    }
    return [];
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
  public flags: string[];
  public references: string[];
  public msgctxt?: string;
  public msgidPlural?: string;
  public msgid?: string;
  public msgstr?: string;
  public msgstrPlural?: string[];

  constructor(public option: POItemOption) {
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
