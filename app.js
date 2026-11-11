'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const state = { maps: [], category: 'Todos', query: '', sort: 'default' };
  const dialog = $('#map-dialog');
  let toastTimer, installTimer, returnFocus;
  const normalize = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  function absoluteURL(value) {
    const url = new URL(value, window.location.href);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Os links dos mapas precisam usar HTTP ou HTTPS.');
    return url.href;
  }
  function validateCatalog(data) {
    if (!data || data.version !== 1 || typeof data.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.updatedAt) || !Array.isArray(data.maps)) throw new Error('Estrutura de catalog.json inválida.');
    const ids = new Set();
    return data.maps.map((map) => {
      const fields = ['id', 'name', 'author', 'description', 'category', 'version', 'previewUrl', 'downloadUrl'];
      if (!map || fields.some((key) => typeof map[key] !== 'string' || !map[key].trim()) || !Array.isArray(map.tags) || map.tags.some((tag) => typeof tag !== 'string') || !Number.isFinite(map.sizeMB) || map.sizeMB < 0 || !Array.isArray(map.spawn) || map.spawn.length !== 3 || !map.spawn.every(Number.isFinite) || !Number.isFinite(map.heading) || ids.has(map.id)) throw new Error('Mapa inválido ou ID duplicado no catálogo.');
      ids.add(map.id);
      return { ...map, previewUrl: absoluteURL(map.previewUrl), downloadUrl: absoluteURL(map.downloadUrl) };
    });
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast-region').replaceChildren(el('div', 'toast', message));
    toastTimer = setTimeout(() => $('#toast-region').replaceChildren(), 6500);
  }
  function preview(map) {
    const frame = el('div', 'preview');
    const fallback = el('div', 'preview-fallback');
    fallback.setAttribute('role', 'img'); fallback.setAttribute('aria-label', 'Prévia ainda não disponível');
    fallback.append(el('span', 'preview-placeholder', 'Imagem não disponível'));
    const image = el('img'); image.alt = `Prévia de ${map.name}`; image.loading = 'lazy'; image.decoding = 'async'; image.hidden = true;
    image.addEventListener('load', () => { image.hidden = false; fallback.hidden = true; });
    image.addEventListener('error', () => { image.remove(); fallback.hidden = false; });
    image.src = map.previewUrl;
    const badges = el('div', 'preview-badges');
    badges.append(el('span', 'badge', map.category.toLocaleUpperCase('pt-BR')), el('span', 'badge size', `${map.sizeMB} MB`));
    frame.append(fallback, image, badges); return frame;
  }
  function tags(map, interactive = false) {
    const wrap = el('div', 'tags');
    map.tags.forEach((tag) => {
      const node = el(interactive ? 'button' : 'span', 'tag', tag);
      if (interactive) { node.type = 'button'; node.setAttribute('aria-label', `Buscar tag ${tag}`); node.addEventListener('click', () => { $('#search').value = tag; state.query = tag; render(); }); }
      wrap.append(node);
    }); return wrap;
  }
  async function copyLink(map) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard indisponível');
      await navigator.clipboard.writeText(map.downloadUrl);
      toast("Link copiado! Cole no botão 'Adicionar por Link' dentro do jogo.");
    } catch {
      openDetails(map, true); $('#direct-link').focus(); $('#direct-link').select();
      toast('A cópia automática não está disponível. Selecione e copie o link exibido.');
    }
  }
  function actions(map) {
    const wrap = el('div', 'actions');
    const install = el('button', 'primary', 'Adicionar no jogo'); install.type = 'button'; install.addEventListener('click', () => installMap(map));
    const copy = el('button', 'secondary', 'Copiar link'); copy.type = 'button'; copy.addEventListener('click', () => copyLink(map));
    const download = el('a', 'download', 'Baixar .skt'); download.href = map.downloadUrl; download.download = `${map.id}.skt`;
    wrap.append(install, copy, download); return wrap;
  }
  function openDetails(map, installHelp = false) {
    $('#dialog-title').textContent = map.name;
    $('#dialog-eyebrow').textContent = installHelp ? 'Adicionar mapa' : 'Detalhes do mapa';
    $('#dialog-author').textContent = `por ${map.author}`;
    $('#dialog-description').textContent = map.description;
    $('#dialog-preview').replaceChildren(preview(map));
    $('#dialog-tags').replaceChildren(...tags(map).children);
    const meta = $('#dialog-meta'); meta.replaceChildren();
    [['Categoria', map.category], ['Tamanho', `${map.sizeMB} MB`], ['Versão', map.version], ['Formato', '.skt'], ['Spawn (x, y, z)', map.spawn.join(', ')], ['Heading', String(map.heading)]].forEach(([label, value]) => { const pair = el('div'); pair.append(el('dt', '', label), el('dd', '', value)); meta.append(pair); });
    $('#install-help').hidden = !installHelp; $('#direct-link').value = map.downloadUrl;
    $('#dialog-actions').replaceChildren(...actions(map).children);
    if (!dialog.open) { returnFocus = document.activeElement; dialog.append($('#toast-region')); dialog.showModal(); }
  }
  async function installMap(map) {
    clearTimeout(installTimer);
    const bridge = window.SkateFreeBridge;
    if (bridge && typeof bridge.installMap === 'function') {
      try {
        // Bridge first: a successful handoff must not also enqueue a second install through the scheme.
        const result = await bridge.installMap(map.downloadUrl, map.id, map.name);
        if (result !== false) { toast('Solicitação enviada ao Skate Free. Acompanhe a instalação dentro do jogo.'); return; }
      } catch { /* Continue with the Android custom-scheme fallback. */ }
    }
    const scheme = 'skatefree://install-map?url=' + encodeURIComponent(map.downloadUrl) + '&id=' + encodeURIComponent(map.id) + '&name=' + encodeURIComponent(map.name);
    // Browsers cannot reliably report whether a custom scheme is registered.
    // Keep the manual path available without claiming installation succeeded.
    openDetails(map, true);
    installTimer = setTimeout(() => { if (!document.hidden) toast('Se o jogo não abriu, copie o link ou baixe o arquivo .skt no painel.'); }, 1200);
    try { window.location.href = scheme; } catch { toast('Copie o link ou baixe o mapa para adicionar no Skate Free.'); }
  }
  function render() {
    const query = normalize(state.query.trim());
    let maps = state.maps.filter((map) => {
      const categoryMatch = state.category === 'Todos' || [map.category, ...map.tags].some((item) => normalize(item) === normalize(state.category));
      return categoryMatch && normalize([map.name, map.author, map.category, ...map.tags].join(' ')).includes(query);
    });
    if (state.sort === 'name') maps.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (state.sort === 'smallest') maps.sort((a, b) => a.sizeMB - b.sizeMB);
    const grid = $('#map-grid'); grid.replaceChildren();
    for (const map of maps) {
      const card = el('article', 'map-card'); const content = el('div', 'card-content');
      const heading = el('h2'); heading.style.margin = '0';
      const title = el('button', 'card-title', map.name); title.type = 'button'; title.setAttribute('aria-label', `Ver detalhes de ${map.name}`); title.addEventListener('click', () => openDetails(map)); heading.append(title);
      content.append(heading, el('p', 'author', `por ${map.author}`), el('p', 'description', map.description), tags(map, true), actions(map));
      card.append(preview(map), content); grid.append(card);
    }
    grid.setAttribute('aria-busy', 'false');
    $('#empty').hidden = maps.length > 0; $('#error').hidden = true;
    $('#results-count').textContent = `${maps.length} ${maps.length === 1 ? 'mapa encontrado' : 'mapas encontrados'}`;
    $('#total-count').textContent = String(state.maps.length);
    $('#clear').hidden = !state.query && state.category === 'Todos';
    document.querySelectorAll('[data-category]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.category === state.category)));
  }
  function reset() { state.query = ''; state.category = 'Todos'; $('#search').value = ''; render(); }
  async function loadCatalog() {
    $('#error').hidden = true; $('#empty').hidden = true; $('#map-grid').setAttribute('aria-busy', 'true'); $('#results-count').textContent = 'Carregando catálogo…'; $('#retry').disabled = true;
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(new URL('catalog.json', window.location.href).href, { cache: 'no-cache', signal: controller.signal });
      if (!response.ok) throw new Error(`Catálogo indisponível (HTTP ${response.status}).`);
      const data = await response.json(); state.maps = validateCatalog(data);
      $('#updated').textContent = `Atualizado em ${data.updatedAt.split('-').reverse().join('/')}`; render();
    } catch (error) {
      $('#map-grid').replaceChildren(); $('#error').hidden = false; $('#results-count').textContent = 'Catálogo indisponível';
      $('#error-message').textContent = location.protocol === 'file:' ? 'Abra o site por um servidor local ou pelo GitHub Pages. O navegador bloqueia o JSON ao abrir por arquivo.' : (error.name === 'AbortError' ? 'O carregamento demorou demais. Confira sua conexão e tente novamente.' : error.message);
    } finally { clearTimeout(timeout); $('#map-grid').setAttribute('aria-busy', 'false'); $('#retry').disabled = false; }
  }
  $('#search').addEventListener('input', (event) => { state.query = event.target.value; render(); });
  $('#sort').addEventListener('change', (event) => { state.sort = event.target.value; render(); });
  document.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => { state.category = button.dataset.category; render(); }));
  $('#clear').addEventListener('click', reset); $('#reset').addEventListener('click', reset); $('#retry').addEventListener('click', loadCatalog);
  $('#close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { const rect = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close(); });
  dialog.addEventListener('close', () => { document.body.append($('#toast-region')); clearTimeout(installTimer); if (returnFocus?.isConnected) returnFocus.focus(); });
  $('#direct-link').addEventListener('click', (event) => event.target.select());
  document.addEventListener('keydown', (event) => { if (event.key === '/' && !dialog.open && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#search').focus(); } });
  loadCatalog();
})();
