// Перебіг уроку: налаштовує редактор, показує крок, стежить за моделлю й переходить далі, коли крок виконано.

import { evaluate, needsDialog, needsMeasure } from './checks.js';

const POLL_MS = 700;
const NEXT_STEP_DELAY_MS = 1200;
const CAMERA_CHECKS = new Set(['camera_rotated', 'camera_home']);

function needsCamera(check) {
  if (!check) return false;
  if (CAMERA_CHECKS.has(check.type)) return true;
  return check.type === 'all' && Array.isArray(check.checks) && check.checks.some(needsCamera);
}

export class Coach {
  /**
   * view: { step(step, index, total), passed(index), finished(), answer() → number | null }
   */
  constructor(editor, highlighter, view) {
    this.editor = editor;
    this.highlighter = highlighter;
    this.view = view;
    this.lesson = null;
    this.index = 0;
    this.ctx = {};
    this.timer = null;
    this.busy = false;
    this.passing = false;
  }

  async start(lesson, firstStep = 0) {
    this.lesson = lesson;
    await this.editor.configure({ tabs: lesson.tabs, keys: lesson.keys });
    await this.editor.runSetup(lesson.setup);
    if (lesson.setup?.length) await this.editor.execute('view.home').catch(() => {});
    this.ctx.homeCamera = await this.editor.camera();
    await this.enter(Math.min(Math.max(firstStep, 0), lesson.steps.length - 1));
    this.timer = setInterval(() => this.poll(), POLL_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.highlighter.clear();
  }

  get step() {
    return this.lesson?.steps[this.index] ?? null;
  }

  async enter(index) {
    this.index = index;
    this.passing = false;
    this.ctx.startCamera = await this.editor.camera();
    this.highlighter.show(this.step.highlight);
    this.view.step(this.step, index, this.lesson.steps.length);
  }

  async state(check) {
    const [doc, camera, dialog] = await Promise.all([
      this.editor.inspect(needsMeasure(check)),
      needsCamera(check) ? this.editor.camera() : null,
      needsDialog(check) ? this.editor.dialog() : null,
    ]);
    return { doc, camera, dialog, answer: this.view.answer() };
  }

  /** Одна перевірка поточного кроку. Викликається таймером і кнопкою «Перевірити». */
  async poll() {
    if (this.busy || this.passing || !this.step) return false;
    this.busy = true;
    try {
      const check = this.step.check;
      const done = evaluate(check, await this.state(check), this.ctx);
      if (done) this.pass();
      return done;
    } catch {
      return false;
    } finally {
      this.busy = false;
    }
  }

  pass() {
    this.passing = true;
    this.highlighter.clear();
    this.view.passed(this.index);
    const last = this.index === this.lesson.steps.length - 1;
    setTimeout(() => {
      if (last) {
        this.stop();
        this.view.finished();
      } else {
        this.enter(this.index + 1);
      }
    }, NEXT_STEP_DELAY_MS);
  }
}
