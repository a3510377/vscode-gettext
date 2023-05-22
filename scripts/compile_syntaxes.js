const yaml = require('js-yaml');
const fs = require('fs');

try {
  fs.readdirSync('syntaxes').forEach((file) => {
    file = `syntaxes/${file}`;

    fs.writeFileSync(
      file.replace(/.yaml$/, '.json'),
      JSON.stringify(yaml.load(fs.readFileSync(file, 'utf8')), null, 2)
    );
  });
} catch (e) {
  console.error(e);
}
