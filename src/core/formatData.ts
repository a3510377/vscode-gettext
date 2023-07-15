/* eslint-disable @typescript-eslint/naming-convention */
/* 
reference: https://github.com/microsoft/vscode/tree/main/extensions
           https://github.com/vslavik/poedit/blob/master/src/syntaxhighlighter.h
*/

import { orRegexp } from '../utils';

// http://en.cppreference.com/w/cpp/io/c/fprintf,
// http://pubs.opengroup.org/onlinepubs/9699919799/functions/fprintf.html
// %(\d+\$)?[-+ #0]{0,5}(\d+|\*)?(\.(\d+|\*))?(hh|ll|[hljztL])?[%csdioxXufFeEaAgGnp])
export const cFormat =
  /%(\d+\$)?[#0\- +']*[,;:_]?((-?\d+)|\*(-?\d+\$)?)?(\.((-?\d+)|\*(-?\d+\$)?)?)?(hh|h|ll|l|j|t|z|q|L|vh|vl|v|hv|hl)?[diouxXDOUeEfFgGaACcSspn%]/g;
export const QTFormat = /(%L?(\d\d?|n))/g;

// old style https://docs.python.org/2/library/stdtypes.html#string-formatting
// new style https://docs.python.org/3/library/string.html#format-string-syntax
// https://peps.python.org/pep-3101/
export const pythonBrace =
  /{{|}}|({\w*(\.[a-zA-Z_]\w*|\[[^\]'"]+\])*(?<arg>(![rsa])?(:\w?[><=^]?[ +-]?#?\d*,?(\.\d+)?[bcdeEfFgGnosxX%]?))?})/g;

export const langFormat = {
  python: orRegexp(
    'g',
    /%(\([\w\s]*\))?[-+#0]*(\d+|\*)?(\.(\d+|\*))?([hlL])?[diouxXeEfFgGcrsab%]/,
    pythonBrace
  ),

  'python-brace': pythonBrace,

  javascript: /%(\([\w\s]*\))?[#0+\- ]*[diouxXeEfFgGcrs%]/g,

  /* ------------------------------------- */
  /* The following is correct confirmation */
  /* ------------------------------------- */

  c: cFormat,
  objc: orRegexp('g', cFormat, /%@/),

  // ruby-format per https://ruby-doc.org/core-2.7.1/Kernel.html#method-i-sprintf
  ruby: /(%(\d+\$)?[-+ #0]{0,5}(\d+|\*)?(\.(\d+|\*))?(hh|ll|[hljztL])?[%csdioxXufFeEaAgGnp])/g,

  // Lua
  lua: /(%[- 0]*\d*(\.\d+)?[sqdiouXxAaEefGgc])/g,

  // Pascal per https://www.freepascal.org/docs-html/rtl/sysutils/format.html
  'object-pascal':
    /(%(\*:|\d*:)?-?(\*|\d+)?(\.\*|\.\d+)?[dDuUxXeEfFgGnNmMsSpP])/g,

  // http://php.net/manual/en/function.sprintf.php
  php: /(%(\d+\$)?[-+]{0,2}([ 0]|'.)?-?\d*(\..?\d+)?[%bcdeEfFgGosuxX])/g,

  'gcc-internal':
    /(?!%')(?!%")%(\d+\$)?[#0\- +']*[,;:_]?((-?\d+)|\*(-?\d+\$)?)?(\.((-?\d+)|\*(-?\d+\$)?)?)?(hh|h|ll|l|j|t|z|q|L|vh|vl|v|hv|hl)?[diouxXDOUeEfFgGaACcSspn%]/g,

  csharp: /(\{[\w.-:,]+\})/g,
  'perl-brace': /(\{[\w.-:,]+\})/g,

  qt: QTFormat,
  'qt-plural': QTFormat,
  kde: QTFormat,
  'kde-kuit': QTFormat,

  // sh: //g,
  // awk: //g,
  // boost: //g,
  // tcl: //g,
  // perl: //g,
  // smalltalk: //g,
  // 'gfc-internal': //g,
  // ycp: //g,
  // scheme: //g,
  // lisp: //g,
  // elisp: //g,
  // librep: //g,
  // java: //g,
  // 'java-printf': //g,
};
