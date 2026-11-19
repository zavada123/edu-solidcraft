// Пройдені уроки з галочкою, так само як у 3D-майстерні (edu-cad) і Blender-уроках.
// Гість пам'ятає їх лише в цьому браузері. Учень, що увійшов на сайт, має свій список у браузері й той самий
// список в акаунті (/api/student/trainer-solved): так уроки бачить учитель класу. Список гостя в акаунт не йде.

const API = '/api/student/';
const TRAINER = 'solidcraft';
const DONE_KEY = 'edu-solidcraft-done';
const ACCOUNT_WAIT_MS = 3000;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const STUDENT_ID_PATTERN = /^[0-9a-f-]{36}$/;

let studentId = null;

export const isValidId = (value) => typeof value === 'string' && ID_PATTERN.test(value);

const doneKey = () => (studentId ? `${DONE_KEY}:${studentId}` : DONE_KEY);

export function loadDone() {
  try {
    const value = JSON.parse(localStorage.getItem(doneKey()) ?? '[]');
    return Array.isArray(value) ? value.filter(isValidId) : [];
  } catch {
    return [];
  }
}

function saveDone(done) {
  try {
    localStorage.setItem(doneKey(), JSON.stringify(done));
  } catch {
    // Приватне вікно чи заборонене сховище: урок пройдено, лише галочки в списку не буде.
  }
}

function sendDone(ids) {
  if (!studentId || ids.length === 0) return;
  fetch(`${API}trainer-solved`, {
    method: 'PUT',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ trainer: TRAINER, solved: ids }),
  }).catch(() => {
    // Без мережі: урок лишається в цьому браузері й піде в акаунт під час наступного відкриття сторінки.
  });
}

export function markDone(id) {
  if (!isValidId(id)) return;
  const done = loadDone();
  if (!done.includes(id)) saveDone([...done, id]);
  sendDone([id]);
}

async function getJson(path) {
  try {
    const response = await fetch(API + path, { credentials: 'same-origin' });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

const field = (value, key) => (typeof value === 'object' && value !== null ? value[key] : undefined);

// Учень, що увійшов: його список у браузері поєднуємо з акаунтом. Гість, дорослий чи без мережі: нічого не робимо.
async function syncWithAccount() {
  const id = field(await getJson('profile'), 'id');
  if (typeof id !== 'string' || !STUDENT_ID_PATTERN.test(id)) return;
  studentId = id;
  const all = await getJson('trainer-solved');
  if (!Array.isArray(all)) return;
  const solved = field(
    all.find((item) => field(item, 'trainer') === TRAINER),
    'solved',
  );
  const server = Array.isArray(solved) ? solved.filter(isValidId) : [];
  const onlyLocal = loadDone().filter((lessonId) => !server.includes(lessonId));
  saveDone([...server, ...onlyLocal]);
  sendDone(onlyLocal);
}

/** Повільний сервер не затримує сторінку довше за кілька секунд. */
export function syncInTime() {
  return Promise.race([syncWithAccount(), new Promise((resolve) => setTimeout(resolve, ACCOUNT_WAIT_MS))]);
}
