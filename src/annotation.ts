import {
  DecorationOptions,
  ExtensionContext,
  TextDocument,
  window,
  workspace,
} from 'vscode';
import { throttle } from 'lodash';

const underlineDecorationType = window.createTextEditorDecorationType({
  textDecoration: 'underline',
});

export const annotation = (ctx: ExtensionContext) => {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  let _current_doc: TextDocument | undefined;

  const refresh = () => {
    const editor = window.activeTextEditor;
    const document = editor?.document;

    if (!editor || !document || _current_doc !== document) return;

    const underlines: DecorationOptions[] = [];

    editor.setDecorations(underlineDecorationType, underlines);
  };
  const update = () => {
    _current_doc = window.activeTextEditor?.document;

    refresh();
  };

  const throttledUpdate = throttle(update, 800);

  window.onDidChangeActiveTextEditor(throttledUpdate);
  window.onDidChangeTextEditorSelection(throttledUpdate);
  workspace.onDidChangeTextDocument((e) => {
    if (e.document === window.activeTextEditor?.document) {
      _current_doc = void 0;
      throttledUpdate();
    }
  });

  // TODO
  // hover
  // languages.registerHoverProvider('*', {
  //   provideHover(document, position, token) {
  //     const offset = document.offsetAt(position);

  //     return;
  //   },
  // });

  update();
};

export default annotation;
