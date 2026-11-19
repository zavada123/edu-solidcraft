# edu-solidcraft · Інженерне 3D

Уроки параметричного 3D-моделювання для 9–11 класів на [eduprostir.com](https://eduprostir.com) у справжньому CAD
[SolidCraft](https://github.com/tangency-labs/solidcraft): ескізи, розміри, видавлювання, історія операцій.

Редактор працює в браузері, а сторінка уроку веде учня крок за кроком: ховає зайві вкладки стрічки й гарячі клавіші,
підсвічує потрібну кнопку і сама перевіряє модель (розміри, об'єм, чи ескіз повністю визначений).

## Як це влаштовано

- `web/app/` — **офіційна браузерна збірка SolidCraft без змін**, архів із релізу авторів
  (версія й sha256 у `solidcraft.env`). У git її немає: `tools/fetch-solidcraft.sh` завантажує й перевіряє архів.
- Сторінка відкриває редактор у iframe як `app/?embed=editor` з того самого домену й керує ним через його офіційний
  JS-API `window.solidcraft` ([browser-api.md](https://github.com/tangency-labs/solidcraft/blob/main/docs/browser-api.md)):
  - `ui.prefs`: українська мова, сховані вкладки (`hidden_toolbar_tabs`), вимкнені функції ШІ;
  - `ui.shortcut`: знімає гарячі клавіші команд, яких немає в уроці;
  - `ui.handles`: координати кнопок, щоб намалювати рамку підсвітки поверх редактора;
  - `inspect({measure: true})`, `ui.camera`, `ui.inspect`: стан моделі для перевірки кроку.

  У режимі `embed=editor` SolidCraft нічого не зберігає в браузері, тож налаштування уроку діють лише в цій вкладці.
- `web/js/` — наш код: `checks.js` (перевірки кроків, чисті функції), `coach.js` (перебіг уроку),
  `highlight.js` (підсвітка), `editor.js` (міст до API), `solved.js` (пройдені уроки в акаунті, як у 3D-майстерні).
- `web/lessons/*.json` — уроки. Новий урок додається без програмування: кроки з текстом, перевіркою (`check`)
  і кнопками для підсвітки (`highlight`, імена з `ui.handles`). Перевірки описані на початку `web/js/checks.js`.

Адреси: `?lesson=<id>` — урок, `&step=N` — з певного кроку, `?lesson=free` — вільний режим, `&webgl` — WebGL2
замість WebGPU (для старих відеокарт).

## Запуск

```
tools/fetch-solidcraft.sh   # офіційний SolidCraft у web/app/
node tools/serve.mjs        # http://localhost:8791/solidcraft/
npm test                    # перевірки, формат уроків, розмітка тексту
node tools/e2e.mjs          # проходить усі уроки в Chromium (Playwright), знімки в shots/
```

## Ліцензії

Наш код — Apache-2.0 (`LICENSE`). SolidCraft — MIT або Apache-2.0, а його назва, логотип і вигляд інтерфейсу —
за [ліцензією бренду SolidCraft](https://github.com/tangency-labs/solidcraft/blob/main/LICENSE-BRAND).
Тому збірку SolidCraft ми не змінюємо, а все навчальне робимо зовні, через його API. Подробиці в `NOTICE.md`.
