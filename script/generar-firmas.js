#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const QR_DIR = path.join(PROJECT_ROOT, 'qr');
const TEMPLATES_DIR = path.join(PROJECT_ROOT, 'plantillas');
const OUT_DIR = path.join(PROJECT_ROOT, 'firmas_out');

function parseArgs(argv) {
  const args = { onlyExpr: null, all: false, csvFile: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') args.all = true;
    else if (a === '--only') args.onlyExpr = argv[++i];
    else if (a === '--csv-file') args.csvFile = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(
        'uso: node script/generar-firmas.js [opciones]\n\n' +
        'opciones:\n' +
        '  --all                Genera todas las filas con `marca` rellena, sin preguntar.\n' +
        '  --only "2,4,43-44"   Genera solo esas filas (numeración del Sheet de Google).\n' +
        '  --csv-file PATH      Lee un CSV local en vez de descargar CSV_URL.\n' +
        '  --help               Muestra esta ayuda.\n\n' +
        'Sin opciones: modo interactivo (lista las filas y pregunta cuáles generar).'
      );
      process.exit(0);
    }
  }
  return args;
}

function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

function downloadCSV(url) {
  return new Promise((resolve, reject) => {
    const get = (u, hops) => {
      if (hops > 5) return reject(new Error('Demasiados redirects al descargar el CSV'));
      const req = https.get(
        u,
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/csv,*/*' } },
        res => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return get(res.headers.location, hops + 1);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode} al descargar el CSV`));
          }
          let data = '';
          res.setEncoding('utf8');
          res.on('data', c => (data += c));
          res.on('end', () => resolve(data));
        }
      );
      req.on('error', reject);
    };
    get(url, 0);
  });
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  while (rows.length && rows[rows.length - 1].every(c => c === '')) rows.pop();
  return rows;
}

function rowsToObjects(rows) {
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).map((cols, i) => {
    const obj = { _sheetRow: i + 2 };
    header.forEach((h, idx) => { obj[h] = (cols[idx] || '').trim(); });
    return obj;
  });
}

function slug(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeQrFilename(qr) {
  if (!qr) return '';
  const trimmed = qr.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    const m = trimmed.match(/\/([^/?#]+\.png)$/i);
    return m ? m[1] : trimmed;
  }
  return trimmed;
}

function pickTemplate(marca, hasQr) {
  const m = (marca || '').toLowerCase();
  let prefix;
  if (m === 'formacion') prefix = 'formacion';
  else if (m === 'autoescuela') prefix = 'autoescuela';
  else return null;
  const suffix = hasQr ? 'con-qr' : 'sin-qr';
  return path.join(TEMPLATES_DIR, `${prefix}-${suffix}.html`);
}

function renderTemplate(tpl, data) {
  const lines = tpl.split('\n');
  const kept = lines.filter(line => {
    const matches = line.match(/\{\{(\w+)\}\}/g);
    if (!matches) return true;
    for (const m of matches) {
      const key = m.slice(2, -2);
      const val = data[key];
      if (val === undefined || val === '') return false;
    }
    return true;
  });
  let out = kept.join('\n');
  out = out.replace(/<div[^>]*>\s*<\/div>\s*/g, '');
  for (const [k, v] of Object.entries(data)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  return out;
}

function parseRowSelector(expr, validRows) {
  if (!expr) return null;
  if (expr.trim().toLowerCase() === 'todas') return new Set(validRows);
  const validSet = new Set(validRows);
  const sel = new Set();
  const unknown = [];
  for (const t of expr.split(',').map(s => s.trim()).filter(Boolean)) {
    const range = t.match(/^(\d+)-(\d+)$/);
    if (range) {
      const a = parseInt(range[1], 10), b = parseInt(range[2], 10);
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      for (let n = lo; n <= hi; n++) {
        if (validSet.has(n)) sel.add(n); else unknown.push(n);
      }
    } else if (/^\d+$/.test(t)) {
      const n = parseInt(t, 10);
      if (validSet.has(n)) sel.add(n); else unknown.push(n);
    } else {
      unknown.push(t);
    }
  }
  if (unknown.length) {
    console.warn(`⚠ filas ignoradas (no existen o sin marca): ${unknown.join(', ')}`);
  }
  return sel;
}

async function askInteractive(rows) {
  console.log('\nEmpleados disponibles (con `marca` rellena):\n');
  const wName = Math.max(...rows.map(r => r.nombre.length));
  for (const r of rows) {
    const qrTag = r.qr ? 'con QR' : 'sin QR';
    const tipo = r['tipo firma'] || '-';
    console.log(`  [${String(r._sheetRow).padStart(3)}] ${r.marca.padEnd(12)} ${tipo.padEnd(10)} ${r.nombre.padEnd(wName)}  ${qrTag}`);
  }
  console.log('');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(resolve => {
    rl.question('¿Qué filas generar? (ej. 2,4,43-44  ·  "todas"  ·  Enter para cancelar)\n> ', a => { rl.close(); resolve(a); });
  });
  return answer.trim();
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv);

  let csvText;
  if (args.csvFile) {
    csvText = fs.readFileSync(args.csvFile, 'utf8');
    console.log(`Leído CSV local: ${args.csvFile}`);
  } else {
    const url = process.env.CSV_URL;
    if (!url) {
      console.error('❌ CSV_URL no definido en .env y no se pasó --csv-file.');
      process.exit(1);
    }
    console.log('Descargando CSV...');
    csvText = await downloadCSV(url);
    if (csvText.trimStart().startsWith('<')) {
      console.error('❌ La URL devolvió HTML en vez de CSV. Probablemente el Sheet ya no está publicado.');
      console.error('   Re-publica el Sheet: Archivo → Compartir → Publicar en la web → CSV → la pestaña concreta → Publicar.');
      process.exit(1);
    }
  }

  const rows = parseCSV(csvText);
  const all = rowsToObjects(rows);
  const procesables = all.filter(r => r.marca);
  if (!procesables.length) {
    console.error('❌ Ninguna fila tiene `marca` rellena.');
    process.exit(1);
  }
  console.log(`${all.length} filas totales, ${procesables.length} con \`marca\` rellena.`);

  let selected;
  const validRows = procesables.map(r => r._sheetRow);
  if (args.all) {
    selected = new Set(validRows);
  } else if (args.onlyExpr) {
    selected = parseRowSelector(args.onlyExpr, validRows);
  } else {
    const answer = await askInteractive(procesables);
    if (!answer) { console.log('Cancelado.'); return; }
    selected = parseRowSelector(answer, validRows);
  }
  if (!selected || selected.size === 0) {
    console.error('❌ Nada que generar.');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let ok = 0;
  const warnings = [];
  for (const row of procesables) {
    if (!selected.has(row._sheetRow)) continue;
    const qrFile = normalizeQrFilename(row.qr);
    if (row.qr && /^https?:\/\//i.test(row.qr)) {
      warnings.push(`fila ${row._sheetRow} (${row.nombre}): la columna 'qr' contenía URL completa; normalizado a "${qrFile}"`);
    }
    const tplPath = pickTemplate(row.marca, !!qrFile);
    if (!tplPath || !fs.existsSync(tplPath)) {
      warnings.push(`fila ${row._sheetRow} (${row.nombre}): no encuentro plantilla para marca="${row.marca}", omito`);
      continue;
    }
    if (qrFile && !fs.existsSync(path.join(QR_DIR, qrFile))) {
      warnings.push(`fila ${row._sheetRow} (${row.nombre}): qr/${qrFile} NO existe en el repo`);
    }
    const tpl = fs.readFileSync(tplPath, 'utf8');
    const data = {
      nombre: row.nombre,
      cargo: row.cargo,
      telefono: row.telefono,
      email: row.email,
      direccion: row.direccion,
      maps_url: row.maps_url,
      qr_filename: qrFile,
    };
    const html = renderTemplate(tpl, data);
    const outName = `${slug(row.nombre)}.html`;
    fs.writeFileSync(path.join(OUT_DIR, outName), html);
    console.log(`  ✓ [${row._sheetRow}] ${row.nombre} → firmas_out/${outName}`);
    ok++;
  }

  console.log(`\nGeneradas ${ok} firma(s) en firmas_out/.`);
  if (warnings.length) {
    console.log('\nAvisos:');
    for (const w of warnings) console.log('  ⚠ ' + w);
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
