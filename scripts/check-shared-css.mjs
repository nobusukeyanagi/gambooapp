/**
 * Structural quality gate for the CSS shared by SCR-210 and SCR-310.
 * Top-level duplicates are prohibited; @media overrides are intentional.
 * Run: npm run check:shared-css
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';

const root = process.cwd();
const shared = [
  'racecard-layout.css',
  'racecard-analyzer.css',
  'racecard-controls.css',
  'race-selector-shared.css',
  'racecard-common.css'
];
const noImportant = new Set(shared.filter(name => name !== 'racecard-common.css'));
const screenNames = ['SCR-210_racecardkeirin.html', 'SCR-310_racecardautorace.html'];
const issues = [];
const cssText = name => readFile(path.join(root, 'assets', name), 'utf8');

for (const filename of shared) {
  const filepath = path.join(root, 'assets', filename);
  try {
    const ast = postcss.parse(await cssText(filename), { from: filepath });
    const seen = new Map();
    for (const node of ast.nodes) {
      if (node.type !== 'rule') continue;
      const selector = node.selector.replace(/\s+/g, ' ').trim();
      const previous = seen.get(selector);
      if (previous) {
        issues.push(`${filename}: top-level selector "${selector}" is duplicated (lines ${previous} and ${node.source.start.line})`);
      } else {
        seen.set(selector, node.source.start.line);
      }
    }
    ast.walkAtRules('import', rule => {
      issues.push(`${filename}:${rule.source.start.line} uses @import; HTML must reference shared CSS directly`);
    });
    if (noImportant.has(filename)) {
      ast.walkDecls(decl => {
        if (decl.important) {
          issues.push(`${filename}:${decl.source.start.line} has unnecessary !important on ${decl.prop}`);
        }
      });
    }
    console.log(`CSS OK ${filename}: ${seen.size} top-level selectors`);
  } catch (error) {
    issues.push(`${filename}: ${error.message}`);
  }
}

const loaded = new Map();
for (const screen of screenNames) {
  const html = await readFile(path.join(root, screen), 'utf8');
  const sheets = [...html.matchAll(/<link\b[^>]*\bhref=["']\.\/assets\/([^"'?]+\.css)(?:\?v=(\d+))?["'][^>]*>/g)]
    .map(match => ({ file: match[1], version: match[2] || '' }));
  const names = sheets.map(sheet => sheet.file);
  if (names[0] !== 'design-tokens.css') {
    issues.push(`${screen}: design-tokens.css must be the first stylesheet`);
  }
  if (names.at(-1) !== 'racecard-common.css') {
    issues.push(`${screen}: racecard-common.css must be the last stylesheet`);
  }
  const versions = new Map();
  for (const name of shared) {
    const instances = sheets.filter(sheet => sheet.file === name);
    if (instances.length !== 1 || !instances[0].version) {
      issues.push(`${screen}: expected exactly one directly linked and versioned ${name}`);
    } else {
      versions.set(name, instances[0].version);
    }
  }
  loaded.set(screen, versions);
}

for (const name of shared) {
  const [a, b] = screenNames.map(screen => loaded.get(screen).get(name));
  if (a && b && a !== b) {
    issues.push(`${name}: cache versions differ between SCR-210 (v${a}) and SCR-310 (v${b})`);
  }
}

if (issues.length) {
  for (const issue of issues) console.error('STYLE ERROR: ' + issue);
  process.exitCode = 1;
} else {
  console.log('Shared racecard CSS OK: unique top-level selectors, direct references, and synchronized versions');
}
