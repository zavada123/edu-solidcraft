// Сторінка уроків: без параметрів — список уроків, ?lesson=<id> — урок, ?lesson=free — вільний режим.
// &step=N відкриває урок із певного кроку (для перевірки уроків), &webgl — редактор на WebGL2 замість WebGPU.

import { Coach } from './coach.js';
import { Editor } from './editor.js';
import { Highlighter } from './highlight.js';
import { loadIndex, loadLesson } from './lessons.js';
import { render } from './richtext.js';
import { loadDone, markDone, syncInTime } from './solved.js';

const $ = (id) => document.getElementById(id);
const BASE = new URL('./', location.href);
const params = new URLSearchParams(location.search);

function showError(message) {
  $('loading').hidden = false;
  $('loading-text').textContent = message;
}

async function showHome() {
  $('home').hidden = false;
  await syncInTime();
  const done = new Set(loadDone());
  const index = await loadIndex(BASE);
  $('lesson-list').replaceChildren(
    ...index.lessons.map((item) => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = `?lesson=${encodeURIComponent(item.id)}`;
      link.textContent = item.title;
      li.append(link);
      if (done.has(item.id)) {
        li.classList.add('done');
        li.title = 'Урок пройдено';
      }
      return li;
    }),
  );
}

function openEditor() {
  const frame = $('editor');
  frame.src = params.has('webgl') ? 'app/?embed=editor&webgl' : 'app/?embed=editor';
  return new Editor(frame);
}

async function waitEditor(editor) {
  await editor.ready((ms) => {
    $('loading-text').textContent = `Завантажуємо редактор… ${Math.round(ms / 1000)} с`;
  });
}

function lessonView(lessonId, lesson) {
  const answerInput = $('answer');
  return {
    step(step, index, total) {
      $('step-box').hidden = false;
      $('step-count').textContent = `Крок ${index + 1} з ${total}`;
      $('step-progress').style.width = `${(index / total) * 100}%`;
      render($('step-task'), step.task);
      $('step-hint').hidden = !step.hint;
      render($('step-hint'), step.hint ?? '');
      const asks = step.check.type === 'answer';
      $('answer-box').hidden = !asks;
      $('answer-unit').textContent = step.check.unit ?? '';
      answerInput.value = '';
      $('step-status').textContent = '';
      $('step-status').className = 'status';
      if (asks) answerInput.focus();
    },
    passed(index) {
      $('step-status').textContent = 'Правильно!';
      $('step-status').className = 'status ok';
      $('step-progress').style.width = `${((index + 1) / lesson.steps.length) * 100}%`;
    },
    finished() {
      markDone(lessonId);
      $('step-box').hidden = true;
      $('finish-box').hidden = false;
      render($('finish-text'), lesson.finish ?? '');
    },
    answer() {
      const value = answerInput.valueAsNumber;
      return Number.isFinite(value) ? value : null;
    },
  };
}

async function showLesson(lessonId) {
  $('lesson').hidden = false;
  setupCollapse();
  const editor = openEditor();

  if (lessonId === 'free') {
    $('lesson-title').textContent = 'Вільний режим';
    $('free-text').hidden = false;
    await waitEditor(editor);
    await editor.configure();
    $('loading').hidden = true;
    return;
  }

  const [lesson] = await Promise.all([loadLesson(BASE, lessonId), syncInTime()]);
  $('lesson-title').textContent = lesson.title;
  document.title = `${lesson.title}: Інженерне 3D`;
  await waitEditor(editor);

  const coach = new Coach(editor, new Highlighter(editor, $('highlight-layer')), lessonView(lessonId, lesson));
  $('check').addEventListener('click', async () => {
    const done = await coach.poll();
    if (!done) {
      $('step-status').textContent = 'Ще ні. Перечитай завдання й спробуй ще раз.';
      $('step-status').className = 'status no';
    }
  });
  const firstStep = Number.parseInt(params.get('step') ?? '1', 10) - 1;
  await coach.start(lesson, Number.isFinite(firstStep) ? firstStep : 0);
  $('loading').hidden = true;
}

function setupCollapse() {
  const button = $('collapse');
  button.addEventListener('click', () => {
    const collapsed = $('panel').classList.toggle('collapsed');
    button.textContent = collapsed ? 'Розгорнути' : 'Згорнути';
    button.setAttribute('aria-expanded', String(!collapsed));
  });
}

async function main() {
  const lessonId = params.get('lesson');
  try {
    if (lessonId) await showLesson(lessonId);
    else await showHome();
  } catch (error) {
    if (lessonId) showError(error.message);
    else $('lesson-list').textContent = error.message;
  }
}

main();
