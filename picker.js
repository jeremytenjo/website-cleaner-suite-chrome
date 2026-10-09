// Runs in the extension's isolated content-script world on the selected page.
globalThis.startElementPicker = function startElementPicker({ save, undo }) {
  globalThis.__hideElementsPickerClose?.();

  const host = document.createElement('div');
  host.id = 'website-cleaner-suite-picker';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      .outline { position:fixed;display:none;border:3px solid #ef7959;background:rgba(239,121,89,.16);border-radius:4px;pointer-events:none; }
      .outline.similar { border-color:#287eaa;background:rgba(40,126,170,.12); }
      .panel { position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));max-width:480px;margin:auto;padding:14px;border-radius:12px;background:#fffefa;color:#1d2825;box-shadow:0 8px 32px #0006;font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:auto; }
      .title { margin:0;font-size:16px;font-weight:700; }
      .hint { margin:5px 0 0;color:#53645a; }
      .selector { display:none;max-height:54px;overflow:auto;margin:10px 0;padding:8px;border-radius:5px;background:#f0f2ed;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere; }
      .actions { display:flex;flex-wrap:wrap;gap:8px;margin-top:12px; }
      button { min-height:44px;padding:9px 12px;border:1px solid #aeb9ae;border-radius:7px;background:#fffefa;color:#1d2825;font:600 13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer; }
      button.primary { border-color:#1d302c;background:#1d302c;color:white; }
      button:disabled { opacity:.45;cursor:not-allowed; }
      button:focus-visible { outline:3px solid #ef7959;outline-offset:2px; }
      [hidden] { display:none !important; }
    </style>
    <div class="outline"></div>
    <section class="panel" role="dialog" aria-label="Pick an element to hide">
      <p class="title">Pick an element</p>
      <p class="hint">Tap an element on the page. You can scroll to find it.</p>
      <div class="selector"></div>
      <div class="actions">
        <button data-action="parent" hidden>Choose parent</button>
        <button data-action="one" class="primary" hidden>Hide this</button>
        <button data-action="similar" hidden>Hide similar</button>
        <button data-action="undo" hidden>Undo</button>
        <button data-action="cancel">Cancel</button>
      </div>
    </section>`;
  (document.documentElement || document.body).appendChild(host);

  const outline = shadow.querySelector('.outline');
  const title = shadow.querySelector('.title');
  const hint = shadow.querySelector('.hint');
  const selectorDisplay = shadow.querySelector('.selector');
  const actions = Object.fromEntries(
    [...shadow.querySelectorAll('[data-action]')].map((button) => [button.dataset.action, button]),
  );
  let selected = null;
  let exact = '';
  let similar = null;
  let savedSelector = null;
  let busy = false;
  let previewingSimilar = false;
  let previewBoxes = [];

  function close() {
    document.removeEventListener('click', onPageClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', drawOutline, true);
    window.removeEventListener('resize', drawOutline);
    host.remove();
    if (globalThis.__hideElementsPickerClose === close)
      delete globalThis.__hideElementsPickerClose;
  }
  globalThis.__hideElementsPickerClose = close;

  function count(selector) {
    try { return document.querySelectorAll(selector).length; }
    catch { return 0; }
  }

  function exactSelector(element) {
    const path = [];
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      if (node.id) {
        const idSelector = `#${CSS.escape(node.id)}`;
        if (count(idSelector) === 1) return [idSelector, ...path].join(' > ');
      }
      let part = node.localName.toLowerCase();
      for (const className of [...node.classList].slice(0, 3)) {
        part += `.${CSS.escape(className)}`;
        if (count(part) === 1) break;
      }
      if (node.parentElement && [...node.parentElement.children].filter((child) => child.matches(part)).length > 1) {
        const siblings = [...node.parentElement.children].filter((child) => child.localName === node.localName);
        part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      path.unshift(part);
      const candidate = path.join(' > ');
      if (count(candidate) === 1) return candidate;
    }
    return path.join(' > ');
  }

  function similarSelector(element) {
    const tag = element.localName.toLowerCase();
    let best = null;
    for (const className of element.classList) {
      if (className === 'style-scope' || className === 'yt-simple-endpoint') continue;
      const selector = `${tag}.${CSS.escape(className)}`;
      const matches = count(selector);
      if (matches > 1 && matches <= 100 && (!best || matches < best.matches))
        best = { selector, matches };
    }
    return best;
  }

  function drawOutline() {
    if (!selected || !selected.isConnected) {
      outline.style.display = 'none';
      return;
    }
    const rect = selected.getBoundingClientRect();
    Object.assign(outline.style, {
      display: 'block', left: `${rect.left}px`, top: `${rect.top}px`,
      width: `${rect.width}px`, height: `${rect.height}px`,
    });
    for (const { element, box } of previewBoxes) {
      const bounds = element.getBoundingClientRect();
      Object.assign(box.style, {
        display: element.isConnected ? 'block' : 'none',
        left: `${bounds.left}px`, top: `${bounds.top}px`,
        width: `${bounds.width}px`, height: `${bounds.height}px`,
      });
    }
  }

  function clearPreview() {
    for (const { box } of previewBoxes) box.remove();
    previewBoxes = [];
    previewingSimilar = false;
  }

  function previewSimilar() {
    if (!similar) return;
    clearPreview();
    previewingSimilar = true;
    const panel = shadow.querySelector('.panel');
    for (const element of document.querySelectorAll(similar.selector)) {
      const box = document.createElement('div');
      box.className = 'outline similar';
      shadow.insertBefore(box, panel);
      previewBoxes.push({ element, box });
    }
    hint.textContent = `The ${similar.matches} blue outlines will be hidden.`;
    selectorDisplay.textContent = similar.selector;
    actions.similar.textContent = `Confirm hide ${similar.matches}`;
    drawOutline();
  }

  function choose(element) {
    if (!element || element === document.body || element === document.documentElement) {
      hint.textContent = 'Choose a smaller part of the page.';
      return;
    }
    clearPreview();
    selected = element;
    exact = exactSelector(element);
    similar = similarSelector(element);
    title.textContent = `Selected: ${element.localName.toLowerCase()}`;
    hint.textContent = 'Check the outline, then choose what to hide.';
    selectorDisplay.textContent = exact;
    selectorDisplay.style.display = 'block';
    actions.parent.hidden = !element.parentElement || element.parentElement === document.body;
    actions.one.hidden = false;
    actions.similar.hidden = !similar;
    if (similar) actions.similar.textContent = `Hide similar (${similar.matches})`;
    drawOutline();
  }

  function onPageClick(event) {
    if (event.composedPath().includes(host)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    choose(event.target instanceof Element ? event.target : event.target?.parentElement);
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') close();
  }

  async function hide(selector) {
    if (busy) return;
    busy = true;
    try {
      const added = await save(selector);
      savedSelector = added ? selector : null;
      title.textContent = added ? 'Element hidden' : 'Rule already saved';
      hint.textContent = added ? 'The rule is saved for this website.' : 'That selector is already in your rules.';
      selectorDisplay.textContent = selector;
      outline.style.display = 'none';
      clearPreview();
      actions.parent.hidden = true;
      actions.one.hidden = true;
      actions.similar.hidden = true;
      actions.undo.hidden = !added;
      actions.cancel.textContent = 'Done';
      document.removeEventListener('click', onPageClick, true);
    } catch (error) {
      hint.textContent = `Could not save: ${error.message || error}`;
    } finally {
      busy = false;
    }
  }

  actions.parent.addEventListener('click', () => choose(selected?.parentElement));
  actions.one.addEventListener('click', () => hide(exact));
  actions.similar.addEventListener('click', () => {
    if (!similar) return;
    if (previewingSimilar) hide(similar.selector);
    else previewSimilar();
  });
  actions.undo.addEventListener('click', async () => {
    if (!savedSelector || busy) return;
    busy = true;
    try {
      await undo(savedSelector);
      savedSelector = null;
      title.textContent = 'Rule removed';
      hint.textContent = 'The element is visible again.';
      actions.undo.hidden = true;
    } catch (error) {
      hint.textContent = `Could not undo: ${error.message || error}`;
    } finally {
      busy = false;
    }
  });
  actions.cancel.addEventListener('click', close);
  document.addEventListener('click', onPageClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('scroll', drawOutline, true);
  window.addEventListener('resize', drawOutline);
};
