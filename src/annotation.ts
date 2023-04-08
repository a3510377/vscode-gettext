import {
  DecorationOptions,
  ExtensionContext,
  TextDocument,
  window,
} from 'vscode';

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
    editor?.setDecorations(underlineDecorationType, underlines);
  };
  const update = () => {
    _current_doc = window.activeTextEditor?.document;

    refresh();
  };

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
