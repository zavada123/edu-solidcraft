// Підсвітка кнопок поверх редактора. SolidCraft малює інтерфейс на canvas, тож DOM-елементів кнопок немає:
// координати центру кожної кнопки дає ui.handles, а рамку малюємо в прозорому шарі над iframe.

const REFRESH_MS = 400;
const RING_SIZE_PX = 64;

export class Highlighter {
  constructor(editor, layer) {
    this.editor = editor;
    this.layer = layer;
    this.targets = [];
    this.rings = new Map();
    this.timer = null;
  }

  /** targets: імена з ui.handles, наприклад "toolbar:solid.extrude" чи "tab:INSPECT". */
  show(targets) {
    this.targets = Array.isArray(targets) ? targets : [];
    this.refresh();
    if (!this.timer && this.targets.length > 0) this.timer = setInterval(() => this.refresh(), REFRESH_MS);
    if (this.targets.length === 0) this.clear();
  }

  clear() {
    clearInterval(this.timer);
    this.timer = null;
    this.targets = [];
    for (const ring of this.rings.values()) ring.remove();
    this.rings.clear();
  }

  async refresh() {
    if (this.targets.length === 0) return;
    let handles;
    try {
      handles = await this.editor.handles();
    } catch {
      return;
    }
    const byName = new Map((Array.isArray(handles) ? handles : []).map((h) => [h.name, h]));
    for (const name of this.targets) {
      const handle = byName.get(name);
      const ring = this.ringFor(name);
      ring.hidden = !handle;
      if (handle) {
        ring.style.left = `${handle.x - RING_SIZE_PX / 2}px`;
        ring.style.top = `${handle.y - RING_SIZE_PX / 2}px`;
      }
    }
  }

  ringFor(name) {
    let ring = this.rings.get(name);
    if (!ring) {
      ring = this.layer.ownerDocument.createElement('div');
      ring.className = 'hl-ring';
      ring.style.width = ring.style.height = `${RING_SIZE_PX}px`;
      ring.dataset.target = name;
      this.layer.append(ring);
      this.rings.set(name, ring);
    }
    return ring;
  }
}
