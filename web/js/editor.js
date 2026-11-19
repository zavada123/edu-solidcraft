// Міст до SolidCraft у iframe. Редактор відкрито з того самого домену в режимі ?embed=editor,
// тож його офіційний API (window.solidcraft, docs/browser-api.md у SolidCraft) доступний напряму.
// Код SolidCraft ми не змінюємо: мову, вкладки й клавіші задаємо його ж налаштуваннями.

const READY_TIMEOUT_MS = 180_000;
const READY_POLL_MS = 250;

// Клавіші, які лишаються завжди: скасувати й повернути дію, вписати модель у вікно.
const ALWAYS_KEYS = Object.freeze(['edit.undo', 'edit.redo', 'view.fit']);

// Вкладки стрічки, які SolidCraft 0.44.1 дозволяє ховати (налаштування hidden_toolbar_tabs).
export const ALL_TABS = Object.freeze(['MODEL', 'SURFACE', 'ASSEMBLE', 'INSERT', 'INSPECT', 'MANAGE', 'VIEW', 'SHEET METAL', 'WELDMENTS']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Editor {
  constructor(frame) {
    this.frame = frame;
    this.api = null;
  }

  /** Чекає, поки WASM завантажиться і з'явиться window.solidcraft. */
  async ready(onWait) {
    const started = Date.now();
    while (Date.now() - started < READY_TIMEOUT_MS) {
      const api = this.frame.contentWindow?.solidcraft;
      if (api && typeof api.request === 'function') {
        this.api = api;
        return api;
      }
      onWait?.(Date.now() - started);
      await sleep(READY_POLL_MS);
    }
    throw new Error('Редактор не завантажився. Онови сторінку або спробуй інший браузер.');
  }

  request(method, params) {
    return this.api.request(method, params ?? {});
  }

  execute(command, params) {
    return this.api.execute(command, params ?? {});
  }

  inspect(measure) {
    return this.api.inspect(measure ? { measure: true } : {});
  }

  camera() {
    return this.request('ui.camera');
  }

  async dialog() {
    const ui = await this.request('ui.inspect');
    return ui?.dialog ?? null;
  }

  /** Координати кнопок на екрані редактора: [{name, x, y}] у пікселях CSS iframe. */
  handles(prefix) {
    return this.request('ui.handles', prefix ? { prefix } : {});
  }

  /**
   * Налаштовує редактор під урок. У режимі embed нічого не зберігається в браузері,
   * тож після перезавантаження сторінки SolidCraft знову стає звичайним.
   */
  async configure({ tabs = null, keys = null } = {}) {
    const hidden = tabs ? ALL_TABS.filter((tab) => !tabs.includes(tab)) : [];
    await this.request('ui.prefs', {
      language: 'uk',
      ai_features: false,
      ai_toolbar_button: false,
      check_updates: false,
      hidden_toolbar_tabs: hidden,
    });
    if (keys) await this.lockKeys(keys);
  }

  /** Знімає гарячі клавіші з усіх команд, яких немає в уроці. */
  async lockKeys(allowed) {
    const keep = new Set([...ALWAYS_KEYS, ...allowed]);
    const commands = await this.api.commands();
    const toClear = (Array.isArray(commands) ? commands : []).filter((c) => c.shortcut && !keep.has(c.id));
    for (const command of toClear) {
      await this.request('ui.shortcut', { command: command.id, key: '' }).catch(() => {
        // Клавішу, яку редактор не дає зняти (зарезервовану), просто лишаємо.
      });
    }
  }

  /** Заготовка уроку: команди, які будують початкову модель. */
  async runSetup(setup) {
    for (const step of setup ?? []) {
      await this.execute(step.command, step.params);
    }
  }
}
