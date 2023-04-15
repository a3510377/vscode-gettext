const linesContent = `
"line1: test\\n awa"
"line2: line3\\n"`;

const lines = linesContent.split('\n');
const data = [];

let startLine = 0;
let tmp = '';
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  if (line.startsWith('"') && line.endsWith('"')) {
    if (line.includes('\\n')) {
      let startIndex = 0;
      for (
        let splitIndex = line.indexOf('\\n');
        splitIndex !== -1;
        splitIndex = line.indexOf('\\n')
      ) {
        tmp += line.slice(startIndex, splitIndex).replace(/^"|"$/, '');

        data.push({
          value: tmp,
          startLine,
          endLine: i,
          endPos: splitIndex,
        });

        tmp = '';
        startLine = i;
        startIndex = splitIndex + 2;
        line = line.slice(startIndex);
      }

      if (line) tmp += line.replace(/^"|"$/, '');
    } else tmp += line.replace(/^"|"$/, '');
  }
}

console.log(data);
