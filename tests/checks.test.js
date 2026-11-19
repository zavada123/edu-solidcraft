import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluate, needsDialog, needsMeasure } from '../web/js/checks.js';

const HOME = { yaw: -Math.PI / 4, pitch: 0.6155 };
const sketch = (over) => ({ id: 1, curves: 0, profiles: 0, dof: 0, status: 'solved', ...over });
const disc = { volume_mm3: 25446.9, closed: true, visible: true, bbox: { min: [-45, -45, 0], max: [45, 45, 4] } };

test('camera_rotated passes only after the view turned far enough', () => {
  const check = { type: 'camera_rotated', min_degrees: 30 };
  assert.equal(evaluate(check, { camera: { yaw: HOME.yaw + 0.1, pitch: HOME.pitch } }, { startCamera: HOME }), false);
  assert.equal(evaluate(check, { camera: { yaw: HOME.yaw + 0.8, pitch: HOME.pitch } }, { startCamera: HOME }), true);
});

test('camera_rotated measures the shortest way round', () => {
  const start = { yaw: Math.PI - 0.05, pitch: 0 };
  const camera = { yaw: -Math.PI + 0.05, pitch: 0 };
  assert.equal(evaluate({ type: 'camera_rotated', min_degrees: 30 }, { camera }, { startCamera: start }), false);
});

test('camera_home passes near the home view only', () => {
  const check = { type: 'camera_home' };
  assert.equal(evaluate(check, { camera: { yaw: HOME.yaw + 0.01, pitch: HOME.pitch } }, { homeCamera: HOME }), true);
  assert.equal(evaluate(check, { camera: { yaw: 0, pitch: 0.2 } }, { homeCamera: HOME }), false);
});

test('sketch_active and sketch_finished follow the active sketch', () => {
  const editing = { doc: { active_sketch: 1, sketches: [sketch()] } };
  const finished = { doc: { active_sketch: null, sketches: [sketch({ curves: 1 })] } };
  assert.equal(evaluate({ type: 'sketch_active' }, editing), true);
  assert.equal(evaluate({ type: 'sketch_finished' }, editing), false);
  assert.equal(evaluate({ type: 'sketch_active' }, finished), false);
  assert.equal(evaluate({ type: 'sketch_finished' }, finished), true);
});

test('sketch_curves needs a closed profile when asked', () => {
  const check = { type: 'sketch_curves', min: 1, profiles: 1 };
  assert.equal(evaluate(check, { doc: { active_sketch: 1, sketches: [sketch({ curves: 1, profiles: 0 })] } }), false);
  assert.equal(evaluate(check, { doc: { active_sketch: 1, sketches: [sketch({ curves: 1, profiles: 1 })] } }), true);
});

test('sketch_defined needs zero degrees of freedom and some geometry', () => {
  const check = { type: 'sketch_defined' };
  assert.equal(evaluate(check, { doc: { active_sketch: 1, sketches: [sketch({ curves: 0, dof: 0 })] } }), false);
  assert.equal(evaluate(check, { doc: { active_sketch: 1, sketches: [sketch({ curves: 1, dof: 1 })] } }), false);
  assert.equal(evaluate(check, { doc: { active_sketch: 1, sketches: [sketch({ curves: 1, dof: 0 })] } }), true);
});

test('dimension_value finds the value among the design parameters', () => {
  const doc = { params: [{ name: 'd1', value: 90, expression: '90' }] };
  assert.equal(evaluate({ type: 'dimension_value', value: 90 }, { doc }), true);
  assert.equal(evaluate({ type: 'dimension_value', value: 80 }, { doc }), false);
});

test('dialog_open matches the command of the open dialog', () => {
  assert.equal(evaluate({ type: 'dialog_open', command: 'solid.extrude' }, { dialog: { command: 'solid.extrude' } }), true);
  assert.equal(evaluate({ type: 'dialog_open', command: 'solid.extrude' }, { dialog: null }), false);
});

test('feature counts working features of a type', () => {
  const ok = { type: 'ExtrudeFeature', error: null, suppressed: false };
  const broken = { ...ok, error: 'failed' };
  const check = { type: 'feature', feature: 'ExtrudeFeature', min: 1 };
  assert.equal(evaluate(check, { doc: { timeline: [broken] } }), false);
  assert.equal(evaluate(check, { doc: { timeline: [broken, ok] } }), true);
  assert.equal(evaluate({ ...check, min: 2 }, { doc: { timeline: [broken, ok] } }), false);
});

test('body checks size in any orientation and volume within tolerance', () => {
  const check = { type: 'body', count: 1, size: [90, 90, 4], volume: 25446.9, volume_tolerance_pct: 1 };
  assert.equal(evaluate(check, { doc: { bodies: [disc] } }), true);
  const standing = { ...disc, bbox: { min: [0, 0, 0], max: [4, 90, 90] } };
  assert.equal(evaluate(check, { doc: { bodies: [standing] } }), true);
  const thick = { ...disc, volume_mm3: 63617, bbox: { min: [-45, -45, 0], max: [45, 45, 10] } };
  assert.equal(evaluate(check, { doc: { bodies: [thick] } }), false);
  assert.equal(evaluate(check, { doc: { bodies: [disc, disc] } }), false);
});

test('body ignores hidden bodies', () => {
  const check = { type: 'body', count: 1, size: [90, 90, 4] };
  assert.equal(evaluate(check, { doc: { bodies: [disc, { ...disc, visible: false }] } }), true);
});

test('answer compares the typed number with tolerance', () => {
  const check = { type: 'answer', value: 25, tolerance: 0.5 };
  assert.equal(evaluate(check, { answer: 25.3 }), true);
  assert.equal(evaluate(check, { answer: 2 }), false);
  assert.equal(evaluate(check, { answer: null }), false);
});

test('all passes only when every sub-check passes', () => {
  const check = { type: 'all', checks: [{ type: 'dimension_value', value: 90 }, { type: 'sketch_defined' }] };
  const doc = { active_sketch: 1, params: [{ value: 90 }], sketches: [sketch({ curves: 1, dof: 1 })] };
  assert.equal(evaluate(check, { doc }), false);
  doc.sketches = [sketch({ curves: 1, dof: 0 })];
  assert.equal(evaluate(check, { doc }), true);
});

test('unknown checks and broken state never pass', () => {
  assert.equal(evaluate({ type: 'nope' }, {}), false);
  assert.equal(evaluate(null, {}), false);
  assert.equal(evaluate({ type: 'body', count: 1 }, { doc: { bodies: 'x' } }), false);
});

test('needsMeasure and needsDialog look into nested checks', () => {
  assert.equal(needsMeasure({ type: 'all', checks: [{ type: 'body' }] }), true);
  assert.equal(needsMeasure({ type: 'sketch_active' }), false);
  assert.equal(needsDialog({ type: 'all', checks: [{ type: 'dialog_open' }] }), true);
  assert.equal(needsDialog({ type: 'answer' }), false);
});
