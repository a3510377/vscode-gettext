console.log(
  'awa,awa,awa,1,2,3,4,5,6'
    .replace(/^#,/, '')
    .trim()
    .split(',')
    .map((flag) => flag.replace(/-format$/, ''))
    .filter((now, i, data) => !data.includes(now, ++i))
);
