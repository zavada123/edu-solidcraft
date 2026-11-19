import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validateLesson } from '../web/js/lessons.js';

const read = (path) => JSON.parse(readFileSync(new URL(`../web/lessons/${path}`, import.meta.url), 'utf8'));
const index = read('index.json');

test('the index lists unique lessons', () => {
  const ids = index.lessons.map((l) => l.id);
  assert.ok(ids.length > 0);
  assert.equal(new Set(ids).size, ids.length);
});

for (const { id, title } of index.lessons) {
  test(`lesson ${id} is valid`, () => {
    const lesson = read(`${id}.json`);
    assert.deepEqual(validateLesson(lesson, id), []);
    assert.equal(lesson.title, title);
  });
}

test('validation reports broken lessons', () => {
  assert.notDeepEqual(validateLesson({ title: 'x', steps: [] }, 'x'), []);
  assert.notDeepEqual(validateLesson({ title: 'x', steps: [{ task: 't', check: { type: 'nope' } }] }, 'x'), []);
  assert.notDeepEqual(validateLesson({ title: 'x', steps: [{ task: 't', check: { type: 'sketch_active' } }] }, 'Bad Id'), []);
});
