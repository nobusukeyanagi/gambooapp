/**
 * Structural quality gate for all app CSS and directly linked assets.
 * Top-level duplicate selectors, raw CSS colors and mismatched asset versions are prohibited.\n * Responsive @media overrides remain intentional.
 * Run: npm run check:shared-css
 */
import { readFile, readdir } from 'node:fs/promises';
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
const allScreens = ['SCR-100_bet.html', 'SCR-200_keirin.html', ...screenNames,
  'SCR-300_autorace.html', 'SCR-400_campaign.html', 'SCR-500_mypage.html', 'index.html'];
const allAssets = new Set(await readdir(path.join(root, 'assets')));
const allCSS = [...allAssets].filter(filename => filename.endsWith('.css')).sort();
const centralizedSelectors = new Set(['.bottom-tab', '.scroll-area::-webkit-scrollbar',
  '.carno', ...Array.from({ length: 9 }, (_, i) => '.carno.w' + (i + 1))]);
const sharedScrollProperties = new Set(['flex', 'overflow-y', 'overflow-x', 'background', 'scrollbar-width']);
const issues = [];
const cssText = name => readFile(path.join(root, 'assets', name), 'utf8');

for (const filename of allCSS) {
  const filepath = path.join(root, 'assets', filename);
  try {
    const ast = postcss.parse(await cssText(filename), { from: filepath });
    const seen = new Map();
    for (const node of ast.nodes) {
      if (node.type !== 'rule') continue;
      const selector = node.selector.replace(/\s+/g, ' ').trim();
      // All screens should reference the common owner, not redefine its parts.
      if (filename !== 'ui-consistency.css' && centralizedSelectors.has(selector)) {
        issues.push(`${filename}:${node.source.start.line} redefines shared UI selector "${selector}"`);
      }
      if (filename !== 'ui-consistency.css' && selector === '.scroll-area') {
        for (const declaration of node.nodes || []) {
          if (declaration.type === 'decl' && sharedScrollProperties.has(declaration.prop)) {
            issues.push(`${filename}:${declaration.source.start.line} redefines shared scroll property ${declaration.prop}`);
          }
        }
      }
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
    if (filename !== 'design-tokens.css') {
      ast.walkDecls(decl => {
        if (/(?:#[0-9a-f]{3,8}\b|(?:rgb|rgba|hsl|hsla)\s*\()/i.test(decl.value)) {
          issues.push(`${filename}:${decl.source.start.line} defines a literal color on ${decl.prop}; use a canonical design token`);
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


const referencedAssets = new Map();
for (const screen of allScreens) {
  const html = await readFile(path.join(root, screen), 'utf8');
  // Sprite definitions must use the shared app-shell rule instead of inline styling.
  if (/<svg\\b[^>]*\\bstyle=[\"'][^\"']*\\bdisplay\\s*:\\s*none/i.test(html)) {
    issues.push(`${screen}: SVG sprite hiding must use the shared icon-sprite class`);
  }
  if (/<symbol\\b/i.test(html) && !/<svg\\b[^>]*\\bclass=[\"'][^\"']*\\bicon-sprite\\b/i.test(html)) {
    issues.push(`${screen}: inline SVG symbol definitions must use icon-sprite`);
  }
  const cssLinks = [...html.matchAll(/<link\b[^>]*\bhref=["']\.\/assets\/([^"'?]+\.css)(?:\?v=(\d+))?["'][^>]*>/g)]
    .map(match => ({ file: match[1], version: match[2] || '', type: 'css' }));
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']\.\/assets\/([^"'?]+\.js)(?:\?v=(\d+))?["'][^>]*>/g)]
    .map(match => ({ file: match[1], version: match[2] || '', type: 'js' }));
  const expectedLast = screenNames.includes(screen) ? 'racecard-common.css' : 'ui-consistency.css';
  if (cssLinks[0]?.file !== 'design-tokens.css' || cssLinks.at(-1)?.file !== expectedLast) {
    issues.push(`${screen}: shared stylesheet order must start with design-tokens.css and end with ${expectedLast}`);
  }
  const local = new Set();
  for (const item of [...cssLinks, ...scripts]) {
    if (!allAssets.has(item.file)) issues.push(`${screen}: missing assets/${item.file}`);
    if (local.has(item.file)) issues.push(`${screen}: duplicate direct reference to assets/${item.file}`);
    local.add(item.file);
    if (!item.version && item.file !== 'qrcode-generator.js') {
      issues.push(`${screen}: unversioned shared asset assets/${item.file}`);
    }
    if (!referencedAssets.has(item.file)) referencedAssets.set(item.file, []);
    referencedAssets.get(item.file).push({ screen, version: item.version });
  }
}
for (const [file, uses] of referencedAssets) {
  if (uses.length < 2) continue;
  const versions = [...new Set(uses.map(use => use.version))];
  if (versions.length !== 1) {
    issues.push(`${file}: cache versions differ across pages: ${uses.map(use => use.screen + '=' + use.version).join(', ')}`);
  }
}

if (issues.length) {
  for (const issue of issues) console.error('STYLE ERROR: ' + issue);
  process.exitCode = 1;
} else {
  console.log(`All CSS/HTML assets OK: ${allCSS.length} stylesheets, ${allScreens.length} pages, direct references and synchronized versions`);
}
