const fs = require('node:fs');
const path = require('node:path');

const entryPath = path.join(__dirname, '..', 'dist', 'server', 'entry.mjs');

if (!fs.existsSync(entryPath)) {
  throw new Error(`No se encontró el archivo de Astro: ${entryPath}`);
}

let source = fs.readFileSync(entryPath, 'utf8');
const replacement = `var client = url.pathToFileURL(path.join(process.env.SPORTMIND_DIST_DIR, "client") + path.sep).href;
var server = url.pathToFileURL(path.join(process.env.SPORTMIND_DIST_DIR, "server") + path.sep).href;`;

if (source.includes('process.env.SPORTMIND_DIST_DIR')) {
  console.log('El servidor Astro ya está preparado para Electron.');
  process.exit(0);
}

const updated = source.replace(
  /var client = "file:[^"]*\/dist\/client\/";\r?\nvar server = "file:[^"]*\/dist\/server\/";/,
  replacement,
);

if (updated === source) {
  throw new Error('No se pudieron actualizar las rutas de ejecución de Astro para Electron.');
}

fs.writeFileSync(entryPath, updated);
console.log('Rutas del servidor Astro preparadas para Electron.');
