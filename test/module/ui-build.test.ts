import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildUi } from '@reflexify/agentflow-app-builder';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const app = path.join(import.meta.dirname, '../..');
/** A specifier a browser cannot resolve: React or an SDK package, which the module must bundle. */
const BARE = /\b(?:from|import)\s*\(?\s*["'](react|react-dom|scheduler|@reflexify\/[\w-]+)(\/[\w./-]+)?["']/;

/** What a script carries that a browser cannot run, or that React's development runtime leaves behind. */
function leftovers(text: string): string[] {
  const out: string[] = [];
  if (text.includes('process.env.NODE_ENV')) out.push('process.env.NODE_ENV');
  if (/\bjsxDEV\b|jsx-dev-runtime/.test(text)) out.push("React's development JSX runtime");
  return out;
}

let out: string;
let files: string[];
const read = (rel: string) => fs.readFileSync(path.join(out, rel), 'utf8');

beforeAll(async () => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'module-build-'));
  // What `agentflow-app build` runs: it builds for production whatever NODE_ENV the test runner set.
  await buildUi(app, 'vite.module.config.ts', out);
  files = (fs.readdirSync(out, { recursive: true }) as string[])
    .map((rel) => rel.split(path.sep).join('/'))
    .filter((rel) => fs.statSync(path.join(out, rel)).isFile())
    .sort();
}, 120_000);

afterAll(() => fs.rmSync(out, { recursive: true, force: true }));

describe('the built UI module', () => {
  it('is one entry, index.js, with every other script under chunks/', () => {
    expect(files).toContain('index.js');
    expect(files.filter((rel) => rel.endsWith('.js') && rel !== 'index.js' && !rel.startsWith('chunks/'))).toEqual([]);
  });

  it('writes no stylesheet beside the script', () => {
    expect(files.filter((rel) => rel.endsWith('.css'))).toEqual([]);
  });

  it('bundles React, the kit and the SDK instead of importing them by name', () => {
    expect(files.filter((rel) => rel.endsWith('.js') && BARE.test(read(rel)))).toEqual([]);
  });

  it("leaves no process.env.NODE_ENV for a browser, and carries React's production runtime", () => {
    for (const rel of files.filter((f) => f.endsWith('.js'))) {
      expect(leftovers(read(rel)), rel).toEqual([]);
    }
  });
});

describe('the checks', () => {
  it('find a bare specifier however it is written, and not a relative one', () => {
    expect(BARE.test('import{jsx}from"react/jsx-runtime";')).toBe(true);
    expect(BARE.test('import"@reflexify/agentflow-elements/kit";')).toBe(true);
    expect(BARE.test("export { x } from 'react-dom';")).toBe(true);
    expect(BARE.test('const m = await import("scheduler");')).toBe(true);
    expect(BARE.test('import{a}from"./chunks/x.js";')).toBe(false);
    expect(BARE.test('import("./chunks/x.js")')).toBe(false);
    expect(BARE.test('import{x}from"react-select";')).toBe(false);
  });

  it('find process.env.NODE_ENV and the development JSX runtime', () => {
    expect(leftovers('if (process.env.NODE_ENV !== "production") warn();')).toEqual(['process.env.NODE_ENV']);
    expect(leftovers('const el = jsxDEV("div", {});')).toEqual(["React's development JSX runtime"]);
    expect(leftovers('import "react/jsx-dev-runtime";')).toEqual(["React's development JSX runtime"]);
    expect(leftovers('const el = jsx("div", {});')).toEqual([]);
  });
});
