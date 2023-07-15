import { ExtensionModule, flatten } from '../utils';

import codeAction from './codeAction';
import definition from './definition';
import problems from './semanticTokens';

export default ((ctx) => {
  const lib: ReturnType<ExtensionModule>[] = [
    problems(ctx),
    definition(ctx),
    codeAction(ctx),
  ];

  return flatten(...lib);
}) as ExtensionModule;
