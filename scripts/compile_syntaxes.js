const yaml = require('js-yaml');
const fs = require('fs');

try {
  fs.readdirSync('syntaxes').forEach((file) => {
    const doc = yaml.load(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(
      file.replace(/.yaml$/, '.json'),
      JSON.stringify(doc, null, 2)
    );
  });
} catch (e) {
  console.error(e);
}
