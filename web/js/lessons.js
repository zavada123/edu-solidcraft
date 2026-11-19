// Список уроків і перевірка їхнього формату. Урок — це JSON у web/lessons/, новий урок додається без програмування.

import { CHECK_TYPES, evaluate } from './checks.js';
import { isValidId } from './solved.js';

/** Повертає список помилок формату уроку (порожній, якщо все гаразд). */
export function validateLesson(lesson, id) {
  const errors = [];
  const where = (i) => `${id}, крок ${i + 1}`;
  if (!isValidId(id)) errors.push(`${id}: недопустимий id`);
  if (typeof lesson?.title !== 'string' || lesson.title.length === 0) errors.push(`${id}: немає title`);
  if (!Array.isArray(lesson?.steps) || lesson.steps.length === 0) {
    errors.push(`${id}: немає кроків`);
    return errors;
  }
  lesson.steps.forEach((step, i) => {
    if (typeof step.task !== 'string' || step.task.length === 0) errors.push(`${where(i)}: немає task`);
    validateCheck(step.check, where(i), errors);
    if (step.highlight !== undefined && !Array.isArray(step.highlight)) errors.push(`${where(i)}: highlight має бути списком`);
  });
  for (const field of ['tabs', 'keys', 'setup']) {
    if (lesson[field] !== undefined && !Array.isArray(lesson[field])) errors.push(`${id}: ${field} має бути списком`);
  }
  return errors;
}

function validateCheck(check, where, errors) {
  if (!check || !CHECK_TYPES.includes(check.type)) {
    errors.push(`${where}: невідома перевірка ${check?.type}`);
    return;
  }
  if (check.type === 'all') (check.checks ?? []).forEach((sub) => validateCheck(sub, where, errors));
  // Порожній стан не повинен проходити жодну перевірку, інакше крок зарахується сам.
  if (evaluate(check, { doc: {}, camera: null, dialog: null, answer: null }, {})) errors.push(`${where}: перевірка проходить без дій учня`);
}

export async function loadIndex(base) {
  const response = await fetch(new URL('lessons/index.json', base));
  if (!response.ok) throw new Error('Не вдалося завантажити список уроків.');
  return response.json();
}

export async function loadLesson(base, id) {
  if (!isValidId(id)) throw new Error('Такого уроку немає.');
  const response = await fetch(new URL(`lessons/${id}.json`, base));
  if (!response.ok) throw new Error('Такого уроку немає.');
  const lesson = await response.json();
  const errors = validateLesson(lesson, id);
  if (errors.length > 0) throw new Error(`Урок зіпсовано: ${errors[0]}`);
  return lesson;
}
