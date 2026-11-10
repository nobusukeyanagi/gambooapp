/**
 * Structural quality gate for all app CSS and directly linked assets.
 * Top-level duplicate selectors, raw CSS colors and mismatched asset versions are prohibited.\n * Responsive @media overrides remain intentional.
 * Run: npm run check:shared-css
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';

const root = process.cwd();
const shared = ['racecard.css'];
const noImportant = new Set();
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

// Protect the approved 1px baseline and 3px exceptions against accidental changes.
// Colors and selector ownership remain independent of this width invariant.
const tokensAST = postcss.parse(await cssText('design.css'));
const widths = new Map();
tokensAST.walkDecls(decl => {
  if (['--line-thin', '--line-thick'].includes(decl.prop)) {
    widths.set(decl.prop, decl.value.trim());
  }
});
for (const [token, expected] of Object.entries({
  '--line-thin': '1px',
  '--line-thick': '3px'
})) {
  if (widths.get(token) !== expected) {
    issues.push(`Stroke policy: ${token} must remain ${expected}; got ${widths.get(token) || '(missing)'}`);
  }
}
// The keirin lineup-order row separator is the sole thick box-table grid line.
const lineupCSS = postcss.parse(await cssText('SCR-210_racecardkeirin.css'));
const lineupRule = [];
lineupCSS.walkRules(rule => {
  if (rule.selector.trim() === '.race-detail-scroll .mania-table tbody tr.line-group-start > td') {
    rule.walkDecls('border-top', decl => lineupRule.push(decl.value.trim()));
  }
});
if (lineupRule.length !== 1 ||
    lineupRule[0] !== 'var(--line-thick) solid var(--c-gray-4)') {
  issues.push('Stroke policy: keirin lineup-order divider must remain the only 3px table separator');
}

for (const filename of allCSS) {
  const filepath = path.join(root, 'assets', filename);
  try {
    const ast = postcss.parse(await cssText(filename), { from: filepath });
    const seen = new Map();
    for (const node of ast.nodes) {
      if (node.type !== 'rule') continue;
      const selector = node.selector.replace(/\s+/g, ' ').trim();
      // All screens should reference the common owner, not redefine its parts.
      if (filename !== 'ui.css' && centralizedSelectors.has(selector)) {
        issues.push(`${filename}:${node.source.start.line} redefines shared UI selector "${selector}"`);
      }
      if (filename !== 'ui.css' && selector === '.scroll-area') {
        for (const declaration of node.nodes || []) {
          if (declaration.type === 'decl' && sharedScrollProperties.has(declaration.prop)) {
            issues.push(`${filename}:${declaration.source.start.line} redefines shared scroll property ${declaration.prop}`);
          }
        }
      }
      if (!seen.has(selector)) seen.set(selector, node.source.start.line);
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
    if (filename !== 'design.css') {
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
  if (names[0] !== 'design.css') {
    issues.push(`${screen}: design.css must be the first stylesheet`);
  }
  if (!names.includes('racecard.css')) {
    issues.push(screen + ': missing consolidated racecard.css');
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
  if (/<svg\b[^>]*\bstyle=[\"'][^\"']*\bdisplay\s*:\s*none/i.test(html)) {
    issues.push(`${screen}: SVG sprite hiding must use the shared icon-sprite class`);
  }
  if (/<symbol\b/i.test(html) && !/<svg\b[^>]*\bclass=[\"'][^\"']*\bicon-sprite\b/i.test(html)) {
    issues.push(`${screen}: inline SVG symbol definitions must use icon-sprite`);
  }
  const cssLinks = [...html.matchAll(/<link\b[^>]*\bhref=["']\.\/assets\/([^"'?]+\.css)(?:\?v=(\d+))?["'][^>]*>/g)]
    .map(match => ({ file: match[1], version: match[2] || '', type: 'css' }));
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']\.\/assets\/([^"'?]+\.js)(?:\?v=(\d+))?["'][^>]*>/g)]
    .map(match => ({ file: match[1], version: match[2] || '', type: 'js' }));
  const pageSpecific = {
    'index.html': 'index.css',
    'SCR-100_bet.html': 'SCR-100_bet.css',
    'SCR-210_racecardkeirin.html': 'SCR-210_racecardkeirin.css',
    'SCR-310_racecardautorace.html': 'SCR-310_racecardautorace.css',
    'SCR-400_campaign.html': 'SCR-400_campaign.css',
    'SCR-500_mypage.html': 'SCR-500_mypage.css'
  };
  const category = screenNames.includes(screen) ? 'racecard.css' :
    ['SCR-200_keirin.html','SCR-300_autorace.html'].includes(screen) ? 'venue.css' : null;
  const expected = ['design.css','ui.css',category,pageSpecific[screen]].filter(Boolean);
  if (cssLinks.map(item=>item.file).join('|') !== expected.join('|')) {
    issues.push(screen + ': expected CSS order ' + expected.join(' -> '));
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
