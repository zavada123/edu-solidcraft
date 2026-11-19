import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse, plain } from '../web/js/richtext.js';

test('parse splits buttons and keys from plain text', () => {
  assert.deepEqual(parse('Натисни **Коло** або [k]C[/k].'), [
    { kind: 'text', text: 'Натисни ' },
    { kind: 'ui', text: 'Коло' },
    { kind: 'text', text: ' або ' },
    { kind: 'key', text: 'C' },
    { kind: 'text', text: '.' },
  ]);
});

test('markup-looking HTML stays plain text', () => {
  assert.deepEqual(parse('<img src=x onerror=alert(1)>'), [{ kind: 'text', text: '<img src=x onerror=alert(1)>' }]);
});

test('plain drops the markup', () => {
  assert.equal(plain('Введи **90** і натисни [k]Enter[/k]'), 'Введи 90 і натисни Enter');
  assert.equal(plain(undefined), '');
});
