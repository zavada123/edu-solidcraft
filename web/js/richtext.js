// Розмітка тексту завдань: **Кнопка** — назва кнопки чи поля, [k]Ctrl+Z[/k] — клавіша.
// Текст уроку ніколи не потрапляє в innerHTML: розбираємо на шматки й будуємо вузли DOM.

const TOKEN = /\*\*(.+?)\*\*|\[k\](.+?)\[\/k\]/g;

/** Розбирає рядок на шматки {kind: 'text' | 'ui' | 'key', text}. */
export function parse(source) {
  const text = String(source ?? '');
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    if (match.index > last) parts.push({ kind: 'text', text: text.slice(last, match.index) });
    parts.push(match[1] !== undefined ? { kind: 'ui', text: match[1] } : { kind: 'key', text: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

/** Текст без розмітки (для title, aria-label). */
export function plain(source) {
  return parse(source)
    .map((p) => p.text)
    .join('');
}

/** Заповнює елемент розміченим текстом. */
export function render(element, source) {
  const doc = element.ownerDocument;
  element.replaceChildren(
    ...parse(source).map((part) => {
      if (part.kind === 'text') return doc.createTextNode(part.text);
      const node = doc.createElement(part.kind === 'ui' ? 'strong' : 'kbd');
      node.textContent = part.text;
      return node;
    }),
  );
}
