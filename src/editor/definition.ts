import {
  Definition,
  Location,
  Position,
  ProviderResult,
  TextDocument,
  languages,
  workspace,
  DefinitionProvider as VscodeDefinitionProvider,
  LocationLink,
} from 'vscode';

import { ExtensionModule } from '../utils';

export class DefinitionProvider implements VscodeDefinitionProvider {
  provideDefinition(
    document: TextDocument,
    position: Position
  ): ProviderResult<Definition | LocationLink[]> {
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
}

export default (() => [
  languages.registerDefinitionProvider('po', new DefinitionProvider()),
]) as ExtensionModule;
