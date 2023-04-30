import { ExtensionContext, TextEditorDecorationType, window } from 'vscode';

export class Annotation {
  decorationType: Record<string, TextEditorDecorationType>;

  constructor(ctx: ExtensionContext) {
    this.decorationType = {
      none: window.createTextEditorDecorationType({}),
      conflict: window.createTextEditorDecorationType({
        gutterIconPath: ctx.asAbsolutePath('res/dark/edit_off.svg'),
      }),
      missing: window.createTextEditorDecorationType({
        gutterIconPath: ctx.asAbsolutePath('res/dark/warning.svg'),
      }),
      disappear: window.createTextEditorDecorationType({
        textDecoration: 'none; display: none;', // a hack to inject custom style
      }),
    };
  }

  clear() {
    const editor = window.activeTextEditor;
    if (!editor) return;

    for (const value of Object.values(this.decorationType)) {
      editor.setDecorations(value, []);
    }
  }

  refresh() {
    const editor = window.activeTextEditor;
    const document = editor?.document;

    if (!(editor && document)) return;

    // TODO feat this
  }
}
