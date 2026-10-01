const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
fs.mkdirSync(output, { recursive: true });
const files = ['index.html'];
for (const folder of ['css', 'js', 'images', 'sounds']) {
  for (const entry of fs.readdirSync(path.join(root, folder), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const relative = path.relative(root, path.join(entry.parentPath || entry.path, entry.name));
    if (/\.(css|js|png|jpg|webp|svg|mp3)$/i.test(relative)) files.push(relative);
  }
}
const allowed = new Set(files.map(file => path.normalize(file)));
for (const entry of fs.readdirSync(output, { recursive: true, withFileTypes: true })) {
  if (entry.isFile()) {
    const relative = path.relative(output, path.join(entry.parentPath || entry.path, entry.name));
    if (!allowed.has(path.normalize(relative))) throw new Error(`Unexpected deploy file: ${relative}`);
  }
}
for (const file of files) {
  const destination = path.join(output, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, file), destination);
}
console.log(`Prepared ${files.length} runtime files in dist`);
