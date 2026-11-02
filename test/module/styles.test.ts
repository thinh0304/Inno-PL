import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/module/styles.css', import.meta.url), 'utf8');

const COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/i;

// A number then the unit, so a word that holds the letters (`.vivid`, `.col-2vw`) is not one.
const VIEWPORT_UNIT = /(?<![\w-])-?(?:\d+\.?\d*|\.\d+)(?:vw|vh|vi|vb|vmin|vmax|[dsl]v[wh])\b/i;
// `(min-width: …)`, `(width >= …)`, and the value-first range `(400px <= width)`.
const WIDTH_MEDIA = /@media[^{]*\(\s*(?:(?:min-|max-)?(?:width|height)\b|[^():{]*[<>]=?\s*(?:width|height)\b)/i;

/** What breaks the module rules in `source`: a stylesheet put in a shadow root beside the kit's. */
function problems(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
  // The root is the first class rule that makes itself a size container, so renaming it needs no edit here.
  const root = /(?:^|\})\s*(\.[\w-]+)\s*\{[^}]*\bcontainer:\s*[\w-]+\s*\/\s*inline-size\b/.exec(code)?.[1];
  if (!root) return ['no rule makes a class the size container (container: <name> / inline-size)'];
  const own = new Set([root, `${root}[data-theme='dark']`, `${root}[data-theme="dark"]`]);
  const out: string[] = [];
  for (const match of code.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1]!.split(',').map((s) => s.trim()).filter(Boolean);
    const body = match[2]!;
    const isOwn = selectors.every((s) => own.has(s));
    for (const s of selectors) if (/^(:root|html|body)\b/.test(s)) out.push(`${s}: a selector outside the shadow root`);
    if (!isOwn && /(?:^|[;{\s])--[\w-]+\s*:/.test(body)) out.push(`${selectors.join(', ')}: custom properties outside ${root}`);
    if (!isOwn && COLOUR.test(body)) out.push(`${selectors.join(', ')}: a colour literal outside ${root}`);
  }
  for (const m of code.matchAll(/var\((--af-[\w-]+)([^)]*)\)/g)) if (!/^,\s*\S/.test(m[2]!)) out.push(`${m[1]}: read without a fallback`);
  if (/prefers-color-scheme/.test(code)) out.push('prefers-color-scheme: the theme comes from the host');
  if (VIEWPORT_UNIT.test(code)) out.push('a viewport unit: the module is not the window');
  if (WIDTH_MEDIA.test(code)) out.push('a width @media query: use @container');
  return out;
}

describe("the module's stylesheet", () => {
  it('follows the module rules', () => {
    expect(problems(css)).toEqual([]);
  });
});

describe('the checks', () => {
  const root =
    ".intake { --bg: var(--af-bg, oklch(0.984 0.003 248)); container: intake / inline-size; }\n" +
    ".intake[data-theme='dark'] { --bg: var(--af-bg, oklch(0.18 0.022 255)); }\n";

  it('follow the root class wherever it is renamed', () => {
    expect(problems(root)).toEqual([]);
  });

  it('find a token on :host, colour literals, a page selector, a bare token, a viewport unit and a width @media', () => {
    const bad = `${root}:host { --ring: var(--af-ring, #2563eb); }\n.row { color: #fff; height: 50vh; }\n` +
      '@media (max-width: 700px) { .row { color: var(--af-fg); } }\nbody { margin: 0; }\n';
    expect(problems(bad)).toEqual([
      ':host: custom properties outside .intake',
      ':host: a colour literal outside .intake',
      '.row: a colour literal outside .intake',
      'body: a selector outside the shadow root',
      '--af-fg: read without a fallback',
      'a viewport unit: the module is not the window',
      'a width @media query: use @container',
    ]);
  });

  it.each(['vmin', 'vmax', 'dvw', 'svw', 'lvw', 'dvh', 'svh', 'lvh', 'vi', 'vb'])('find the viewport unit %s', (unit) => {
    expect(problems(`${root}.row { min-height: 40${unit}; }\n`)).toEqual(['a viewport unit: the module is not the window']);
    expect(problems(`${root}.row { margin: -.5${unit}; }\n`)).toEqual(['a viewport unit: the module is not the window']);
  });

  it('find no viewport unit inside a word', () => {
    expect(problems(`${root}.vivid, .col-2vw { grid-area: vb; animation-name: vmin; }\n`)).toEqual([]);
  });

  it.each(['(width >= 400px)', '(400px <= width)', 'screen and (400px < width < 800px)', '(height > 30em)'])(
    'find the range @media %s',
    (query) => {
      expect(problems(`${root}@media ${query} { .row { gap: 0; } }\n`)).toEqual(['a width @media query: use @container']);
    },
  );

  it('allow prefers-reduced-motion and refuse prefers-color-scheme', () => {
    expect(problems(`${root}@media (prefers-reduced-motion: reduce) { .row { transition: none; } }\n`)).toEqual([]);
    expect(problems(`${root}@media (prefers-color-scheme: dark) { .row { opacity: 1; } }\n`)).toEqual([
      'prefers-color-scheme: the theme comes from the host',
    ]);
  });

  it('find a stylesheet with no root', () => {
    expect(problems('.x { color: var(--af-fg, oklch(0.21 0.035 255)); }')).toEqual([
      'no rule makes a class the size container (container: <name> / inline-size)',
    ]);
  });
});
