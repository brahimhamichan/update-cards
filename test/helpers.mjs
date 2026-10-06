import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
export const EXAMPLES = readdirSync(join(ROOT, 'examples')).filter((f) => f.endsWith('.json')).map((f) => join(ROOT, 'examples', f));
export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
export const tempDir = (prefix = 'uc-test-') => mkdtempSync(join(tmpdir(), prefix));

export const ENDPOINT = 'https://hooks.example.test/x';
export const LIVE = { webhookUrl: ENDPOINT, requestId: 'req_test' };

/** One minimal valid config per card type (explanation has all three variants). */
export const CARDS = {
  'yes-no': { type: 'yes-no', id: 'yn', title: 'Ship it?', body: 'Deploy `main`.', allowNote: true },
  form: {
    type: 'form',
    id: 'fm',
    title: 'Details',
    fields: [
      { id: 'name', type: 'text', label: 'Name', required: true },
      { id: 'bio', type: 'textarea', label: 'Bio', default: 'hi' },
      { id: 'size', type: 'select', label: 'Size', options: [{ value: 's', label: 'S' }, { value: 'l', label: 'L' }], default: 'l' },
      { id: 'color', type: 'radio', label: 'Color', options: [{ value: 'r', label: 'Red' }, { value: 'b', label: 'Blue' }] },
      { id: 'tags', type: 'checkbox', label: 'Tags', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], default: ['a'] },
      { id: 'agree', type: 'checkbox', label: 'Agree' },
    ],
  },
  checklist: { type: 'checklist', id: 'cl', title: 'Checks', items: [{ id: 'a', label: 'A', checked: true }, { id: 'b', label: 'B' }] },
  'bullet-points': { type: 'bullet-points', id: 'bp', title: 'Status', items: [{ text: 'Done', status: 'done' }, { text: 'Next', status: 'next' }] },
  'big-text': { type: 'big-text', id: 'bt', title: 'Result', value: '42%', delta: { text: '+3', direction: 'up' } },
  'explanation-steps': { type: 'explanation', id: 'ex1', title: 'How', variant: 'steps', steps: [{ title: 'One' }, { title: 'Two' }] },
  'explanation-flow': { type: 'explanation', id: 'ex2', title: 'How', variant: 'flow', nodes: [{ label: 'A' }, { label: 'B' }] },
  'explanation-comparison': {
    type: 'explanation',
    id: 'ex3',
    title: 'Compare',
    variant: 'comparison',
    columns: [{ title: 'X', recommended: true, points: ['p'] }, { title: 'Y', points: [{ text: 'q', kind: 'con' }] }],
  },
  'app-name-choice': {
    type: 'app-name-choice',
    id: 'an',
    title: 'Name',
    options: [{ id: 'one', name: 'One', recommended: true }, { id: 'two', name: 'Two' }],
  },
};

export function imageChoice(srcs, id = 'ic') {
  return { type: 'image-choice', id, title: 'Pick', options: srcs.map((src, i) => ({ id: `o${i}`, src, alt: `Option ${i}`, caption: `Cap ${i}` })) };
}

export const TINY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="red"/></svg>';
// 1x1 transparent PNG
export const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

export function writeImages(dir) {
  const svg = join(dir, 'a.svg');
  const png = join(dir, 'b.png');
  writeFileSync(svg, TINY_SVG);
  writeFileSync(png, TINY_PNG);
  return { svg, png };
}

export const count = (haystack, needle) => haystack.split(needle).length - 1;
export const scriptTags = (html) => count(html, '<script');
export const dataBlock = (html) => JSON.parse(html.match(/<script type="application\/json" id="uc-data">([\s\S]*?)<\/script>/)[1]);
