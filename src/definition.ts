import {
  Definition,
  DefinitionLink,
  Location,
  Position,
  ProviderResult,
  TextDocument,
  workspace,
} from 'vscode';

export function getTextProvideDefinition(
  document: TextDocument,
  position: Position
): ProviderResult<Definition | DefinitionLink[]> {
  const poLine = document.lineAt(position).text;

  if (poLine.startsWith('#: ')) {
    const [path, line] = poLine.split(' ')[1].split(':');
    return workspace.findFiles(path).then((files) => {
      if (!files) return;
      const sourcePosition = new Position(+line - 1, 0);

      return files.map((file) => new Location(file, sourcePosition));
    });
  }
}
