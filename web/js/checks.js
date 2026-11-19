// Перевірки кроків уроку. Чисті функції: на вході стан редактора, на виході «виконано чи ні».
//
// state = {
//   doc:    відповідь solidcraft.inspect({measure: true}),
//   camera: відповідь ui.camera ({yaw, pitch, ...}),
//   dialog: ui.inspect().dialog (відкритий діалог команди або null),
//   answer: число, яке учень увів у полі відповіді (або null),
// }
// ctx = { startCamera, homeCamera } — положення камери на початку кроку й на початку уроку.

const DEG = Math.PI / 180;
const HOME_TOLERANCE_RAD = 3 * DEG;
const DEFAULT_SIZE_TOLERANCE_MM = 0.5;
const DEFAULT_VOLUME_TOLERANCE_PCT = 1;

const sketches = (doc) => (Array.isArray(doc?.sketches) ? doc.sketches : []);
const bodies = (doc) => (Array.isArray(doc?.bodies) ? doc.bodies.filter((b) => b.visible !== false) : []);
const timeline = (doc) => (Array.isArray(doc?.timeline) ? doc.timeline : []);

function activeSketch(doc) {
  const id = doc?.active_sketch;
  if (id === null || id === undefined) return null;
  return sketches(doc).find((s) => s.id === id) ?? null;
}

/** Кут між двома положеннями камери в радіанах; NaN, якщо якогось положення немає (тоді перевірка не проходить). */
function angleBetween(a, b) {
  if (!a || !b) return Number.NaN;
  const dyaw = Math.atan2(Math.sin(a.yaw - b.yaw), Math.cos(a.yaw - b.yaw));
  return Math.hypot(dyaw, a.pitch - b.pitch);
}

function sizeOf(body) {
  const { min, max } = body.bbox ?? {};
  if (!Array.isArray(min) || !Array.isArray(max)) return null;
  return [0, 1, 2].map((i) => max[i] - min[i]);
}

/** Розміри порівнюються без огляду на те, вздовж якої осі лежить деталь. */
function sizeMatches(actual, expected, tolerance) {
  if (!actual) return false;
  const a = [...actual].sort((x, y) => x - y);
  const e = [...expected].sort((x, y) => x - y);
  return a.every((value, i) => Math.abs(value - e[i]) <= tolerance);
}

function near(actual, expected, tolerance) {
  return typeof actual === 'number' && Math.abs(actual - expected) <= tolerance;
}

function paramValues(doc) {
  const params = Array.isArray(doc?.params) ? doc.params : [];
  return params.map((p) => (typeof p === 'number' ? p : p?.value)).filter((v) => typeof v === 'number');
}

const CHECKS = {
  camera_rotated: (c, s, ctx) => angleBetween(s.camera, ctx.startCamera) >= (c.min_degrees ?? 30) * DEG,

  camera_home: (c, s, ctx) => angleBetween(s.camera, ctx.homeCamera) <= HOME_TOLERANCE_RAD,

  sketch_active: (c, s) => activeSketch(s.doc) !== null,

  sketch_curves: (c, s) => {
    const sketch = activeSketch(s.doc);
    return sketch !== null && sketch.curves >= (c.min ?? 1) && sketch.profiles >= (c.profiles ?? 0);
  },

  sketch_defined: (c, s) => {
    const sketch = activeSketch(s.doc) ?? sketches(s.doc).at(-1);
    return Boolean(sketch) && sketch.curves > 0 && sketch.dof === 0 && sketch.status === 'solved';
  },

  dimension_value: (c, s) => paramValues(s.doc).some((v) => near(v, c.value, c.tolerance ?? 0.01)),

  sketch_finished: (c, s) => activeSketch(s.doc) === null && sketches(s.doc).length >= (c.min ?? 1),

  dialog_open: (c, s) => s.dialog?.command === c.command,

  feature: (c, s) => timeline(s.doc).filter((f) => f.type === c.feature && !f.error && !f.suppressed).length >= (c.min ?? 1),

  body: (c, s) => {
    const list = bodies(s.doc);
    if (list.length !== (c.count ?? 1)) return false;
    const body = list[0];
    if (c.size && !sizeMatches(sizeOf(body), c.size, c.tolerance ?? DEFAULT_SIZE_TOLERANCE_MM)) return false;
    if (typeof c.volume === 'number') {
      const pct = c.volume_tolerance_pct ?? DEFAULT_VOLUME_TOLERANCE_PCT;
      if (!near(body.volume_mm3, c.volume, (Math.abs(c.volume) * pct) / 100)) return false;
    }
    return body.closed !== false;
  },

  answer: (c, s) => near(s.answer, c.value, c.tolerance ?? 0),

  all: (c, s, ctx) => Array.isArray(c.checks) && c.checks.length > 0 && c.checks.every((sub) => evaluate(sub, s, ctx)),
};

export const CHECK_TYPES = Object.freeze(Object.keys(CHECKS));

/** Чи потрібні перевірці виміри тіл (повільніший inspect). */
export function needsMeasure(check) {
  if (!check) return false;
  if (check.type === 'body') return true;
  return check.type === 'all' && Array.isArray(check.checks) && check.checks.some(needsMeasure);
}

/** Чи потрібен перевірці відкритий діалог (ui.inspect). */
export function needsDialog(check) {
  if (!check) return false;
  if (check.type === 'dialog_open') return true;
  return check.type === 'all' && Array.isArray(check.checks) && check.checks.some(needsDialog);
}

export function evaluate(check, state, ctx = {}) {
  const fn = CHECKS[check?.type];
  if (!fn) return false;
  try {
    return Boolean(fn(check, state ?? {}, ctx));
  } catch {
    return false;
  }
}
