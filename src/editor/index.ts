import { ExtensionModule, flatten } from '../utils';

import problems from './problems';
import definition from './definition';

export default ((ctx) =>
  flatten(problems(ctx), definition(ctx))) as ExtensionModule;
