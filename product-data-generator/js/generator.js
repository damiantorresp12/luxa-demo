/* LUXA Product Data Generator V1
 * Lee assets/Imagenes/, pre-llena con datos del planner + app,
 * UI de tarjetas + side panel, guarda a space-planner/catalogs/<id>/products.json.
 *
 * Stack: Vanilla JS, sin dependencias. Lee `window.LUXA` que ya está cargado por
 * <script src="../js/catalog.data.js"> en el index.html.
 */

(() => {
  'use strict';

  // ---------- Configuration ----------

  const IMAGES_PATH = 'assets/Imagenes';
  const STORAGE_PREFIX = 'luxa.generator.v1';
  const ACTIVE_CATALOG_KEY = 'luxa.generator.activeCatalog';
  const DEFAULT_CATALOG_ID = 'luxa-original';

  // Mapping from the app's `category` field to the planner's `type` field.
  const CATEGORY_TO_TYPE = {
    'Pendants': 'pendant',
    'Pendant Lights': 'pendant',
    'Chandeliers': 'pendant',
    'Ceiling Lights': 'ceiling_light',
    'Wall Lights': 'wall_light',
    'Wall Lamps': 'wall_light',
    'Table Lamps': 'table_lamp',
    'Table Lights': 'table_lamp',
    'Floor Lamps': 'floor_lamp',
    'Floor Lights': 'floor_lamp',
    'Downlights': 'downlight',
    'Recessed': 'downlight',
    'Spotlights': 'spotlight',
    'Spots': 'spotlight',
    'Track': 'spotlight',
    'Linear': 'linear_light',
    'Linear Lights': 'linear_light'
  };

  // Known collection name fragments — when we see one in a name we infer the
  // collection. Order matters; first match wins.
  const KNOWN_COLLECTIONS = [
    'Aballs', 'Lighto', 'Lightolight', 'Arum', 'Tempo', 'Aim', 'Bolle',
    'Aplomb', 'Arena', 'Awa', 'Arco', 'Apollo', 'Ayno', 'Atollo', '265',
    'Bo32', 'Came', 'Flat', 'Cellar', 'Champignon', 'Soffio', 'Nude',
    'Pirro', 'Soho', 'Pure', 'Mist', 'Tak'
  ];

  // ---------- State ----------

  const state = {
    catalogs: [],          // [{ id, name, description }]
    activeCatalog: null,   // string
    items: [],             // [{ key, image, status, base, ...productFields, _baseline }]
    plannerProductsBaseline: [], // products.json fresh from the planner
    selectedKey: null,
    filters: { search: '', status: '', type: '', collection: '' }
  };

  // ---------- DOM ----------

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    picker: $('#catalog-picker'),
    btnImport: $('#btn-import'),
    fileInput: $('#file-input'),
    dropOverlay: $('#drop-overlay'),
    btnReload: $('#btn-reload'),
    btnExport: $('#btn-export'),
    btnSave: $('#btn-save'),
    btnRevert: $('#btn-revert'),
    btnRemove: $('#btn-remove'),
    fSearch: $('#f-search'),
    fStatus: $('#f-status'),
    fType: $('#f-type'),
    fCollection: $('#f-collection'),
    fReset: $('#f-reset'),
    summary: $('#summary-text'),
    grid: $('#card-grid'),
    emptyState: $('#empty-state'),
    sidePanel: $('#side-panel'),
    sideEmpty: $('#side-empty'),
    sideForm: $('#side-form'),
    sideThumb: $('#side-thumb'),
    sideStatus: $('#side-status'),
    sideTitle: $('#side-title'),
    sideImageName: $('#side-image-name'),
    fldName: $('#fld-name'),
    fldId: $('#fld-id'),
    fldCatalogId: $('#fld-catalogId'),
    fldCategory: $('#fld-category'),
    fldType: $('#fld-type'),
    fldCollection: $('#fld-collection'),
    fldStyle: $('#fld-style'),
    fldSpaces: $('#fld-spaces'),
    fldImage: $('#fld-image'),
    toast: $('#toast')
  };

  // ---------- Utilities ----------

  const escapeHtml = (str) =>
    String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));

  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function toast(msg, kind = '') {
    els.toast.textContent = msg;
    els.toast.className = 'toast ' + kind;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.add('hidden'), 3000);
  }

  function inferCollection(name) {
    if (!name) return '';
    for (const col of KNOWN_COLLECTIONS) {
      const rx = new RegExp(`\\b${col}\\b`, 'i');
      if (rx.test(name)) return col;
    }
    return '';
  }

  function mapCategoryToType(category) {
    if (!category) return '';
    return CATEGORY_TO_TYPE[category] || '';
  }

  // Strip "_corona" / "_vray" / "_render" suffixes from an image basename to get
  // a cleaner display name. e.g. "DVA-Aballs A Wall Light_corona" → "DVA-Aballs A Wall Light"
  function cleanName(base) {
    return base.replace(/_(corona|vray|render|raw|final)\b.*$/i, '').trim();
  }

  // Derive a stable planner-style id from an image filename. e.g.
  // "DVA-Aballs A Wall Light_corona.jpg" → "DVA-Aballs-A-Wall-Light"
  function deriveIdFromFilename(filename) {
    const base = filename.replace(/\.[^.]+$/, '');
    return cleanName(base).replace(/\s+/g, '-').replace(/[^A-Za-z0-9_-]/g, '');
  }

  function imageRelPath(filename) {
    return `../assets/Imagenes/${filename}`;
  }

  // ---------- Persistence (localStorage per catalog) ----------

  function storageKey() {
    return `${STORAGE_PREFIX}.${state.activeCatalog || DEFAULT_CATALOG_ID}`;
  }

  function persistDraft() {
    try {
      const payload = state.items.map(it => ({
        key: it.key,
        image: it.image,
        id: it.id,
        catalogId: it.catalogId,
        name: it.name,
        category: it.category,
        type: it.type,
        collection: it.collection,
        style: it.style,
        spaces: it.spaces,
        removed: it.removed
      }));
      localStorage.setItem(storageKey(), JSON.stringify({
        catalog: state.activeCatalog,
        savedAt: new Date().toISOString(),
        items: payload
      }));
    } catch (e) { /* ignore */ }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function clearDraft() {
    try { localStorage.removeItem(storageKey()); } catch (e) { /* ignore */ }
  }

  // ---------- Data loading ----------

  async function loadCatalogIndex() {
    let ids = [];
    try {
      const res = await fetch('../space-planner/catalogs.json', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        ids = Array.isArray(json.catalogs) ? json.catalogs : [];
      }
    } catch (e) { /* ignore */ }
    if (!ids.length) ids = [DEFAULT_CATALOG_ID];

    const catalogs = [];
    for (const id of ids) {
      try {
        const res = await fetch(`../space-planner/catalogs/${id}/meta.json`, { cache: 'no-store' });
        if (!res.ok) throw new Error('no meta');
        const meta = await res.json();
        catalogs.push({ id, name: meta.name || id, description: meta.description || '' });
      } catch (e) {
        catalogs.push({ id, name: id, description: '' });
      }
    }
    state.catalogs = catalogs;
    return catalogs;
  }

  async function loadPlannerProducts(catalogId) {
    try {
      const res = await fetch(`../space-planner/catalogs/${catalogId}/products.json`, { cache: 'no-store' });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    } catch (e) {
      return [];
    }
  }

  async function listImages() {
    try {
      const res = await fetch(`/__list?path=${encodeURIComponent(IMAGES_PATH)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'unknown');
      return json.files || [];
    } catch (e) {
      console.error('listImages failed', e);
      toast(`No se pudo leer ${IMAGES_PATH}. Está corriendo luxa-server.bat?`, 'error');
      return [];
    }
  }

  // ---------- Build items (the magic of pre-filling) ----------

  function buildItems(imageFiles, plannerProducts) {
    // Index existing planner products by image filename
    const plannerByImage = {};
    plannerProducts.forEach(p => {
      const fn = (p.image || '').split('/').pop();
      if (fn) plannerByImage[fn] = p;
    });

    // Index app products (from window.LUXA) by image filename
    const appProducts = (window.LUXA && Array.isArray(window.LUXA.products))
      ? window.LUXA.products : [];
    const appByImage = {};
    appProducts.forEach(p => {
      const img = p.assets && p.assets.image;
      if (!img) return;
      const fn = img.split('/').pop();
      appByImage[fn] = p;
    });

    const items = imageFiles.map(filename => {
      const base = filename.replace(/\.[^.]+$/, '');
      const fromPlanner = plannerByImage[filename];
      const fromApp = appByImage[filename];

      let item;
      if (fromPlanner) {
        // Full data already in planner — use it as-is.
        item = {
          key: filename,
          image: fromPlanner.image || imageRelPath(filename),
          id: fromPlanner.id || deriveIdFromFilename(filename),
          catalogId: fromPlanner.catalogId || '',
          name: fromPlanner.name || cleanName(base),
          category: fromPlanner.category || '',
          type: fromPlanner.type || '',
          collection: fromPlanner.collection || '',
          style: fromPlanner.style || '',
          spaces: Array.isArray(fromPlanner.spaces) ? fromPlanner.spaces.slice() : []
        };
      } else if (fromApp) {
        // Map app schema → planner schema. Collection/style/spaces are blank.
        item = {
          key: filename,
          image: imageRelPath(filename),
          id: deriveIdFromFilename(filename),
          catalogId: fromApp.id || '',
          name: fromApp.name || cleanName(base),
          category: fromApp.category || '',
          type: mapCategoryToType(fromApp.category),
          collection: inferCollection(fromApp.name || base),
          style: '',
          spaces: []
        };
      } else {
        // Brand new image (e.g. the 2 Arum) — minimal skeleton.
        item = {
          key: filename,
          image: imageRelPath(filename),
          id: deriveIdFromFilename(filename),
          catalogId: '',
          name: cleanName(base),
          category: '',
          type: '',
          collection: inferCollection(base),
          style: '',
          spaces: []
        };
      }
      item.removed = false;
      // baseline = the "official" state from disk; used by Revert
      item._baseline = Object.assign({}, item);
      delete item._baseline._baseline;
      item.status = computeStatus(item);
      return item;
    });

    return items;
  }

  function computeStatus(item) {
    if (item.removed) return 'removed';
    const required = ['name', 'type', 'collection'];
    const haveAll = required.every(k => item[k] && String(item[k]).trim());
    const haveSpaces = Array.isArray(item.spaces) && item.spaces.length > 0;
    const partial = item.name || item.type || item.collection || haveSpaces;
    if (haveAll && haveSpaces) return 'complete';
    if (partial) return 'partial';
    return 'empty';
  }

  function applyDraftOverlay(items, draft) {
    if (!draft || !Array.isArray(draft.items)) return items;
    const byKey = {};
    draft.items.forEach(d => { byKey[d.key] = d; });
    items.forEach(item => {
      const d = byKey[item.key];
      if (!d) return;
      // Overlay user edits on top of baseline
      Object.assign(item, {
        id: d.id ?? item.id,
        catalogId: d.catalogId ?? item.catalogId,
        name: d.name ?? item.name,
        category: d.category ?? item.category,
        type: d.type ?? item.type,
        collection: d.collection ?? item.collection,
        style: d.style ?? item.style,
        spaces: Array.isArray(d.spaces) ? d.spaces.slice() : item.spaces,
        removed: !!d.removed
      });
      item.status = computeStatus(item);
    });
    return items;
  }

  // ---------- Rendering ----------

  function renderCatalogPicker() {
    els.picker.innerHTML = state.catalogs.map(c =>
      `<option value="${escapeHtml(c.id)}"${c.id === state.activeCatalog ? ' selected' : ''}>${escapeHtml(c.name)}</option>`
    ).join('');
    els.picker.disabled = state.catalogs.length <= 1;
  }

  function renderFilterOptions() {
    const types = Array.from(new Set(state.items.map(i => i.type).filter(Boolean))).sort();
    const cols  = Array.from(new Set(state.items.map(i => i.collection).filter(Boolean))).sort();
    fillSelect(els.fType, types);
    fillSelect(els.fCollection, cols);
  }

  function fillSelect(select, options) {
    const first = select.querySelector('option');
    select.innerHTML = '';
    select.appendChild(first);
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt; o.textContent = opt;
      select.appendChild(o);
    });
  }

  function getFiltered() {
    const { search, status, type, collection } = state.filters;
    const q = search.trim().toLowerCase();
    return state.items.filter(it => {
      if (status && it.status !== status) return false;
      if (type && it.type !== type) return false;
      if (collection && it.collection !== collection) return false;
      if (q) {
        const hay = `${it.name || ''} ${it.id || ''} ${it.catalogId || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderGrid() {
    const filtered = getFiltered();
    if (!filtered.length) {
      els.grid.innerHTML = '';
      els.emptyState.hidden = false;
    } else {
      els.emptyState.hidden = true;
      els.grid.innerHTML = filtered.map(cardHTML).join('');
      els.grid.querySelectorAll('.card').forEach(node => {
        node.addEventListener('click', () => selectCard(node.dataset.key));
      });
    }
    renderSummary();
  }

  function cardHTML(it) {
    const selected = it.key === state.selectedKey ? ' selected' : '';
    const removed = it.removed ? ' is-removed' : '';
    return `
      <div class="card${selected}${removed}" data-key="${escapeHtml(it.key)}" title="${escapeHtml(it.image)}">
        <span class="status-badge ${it.status}" title="${statusLabel(it.status)}"></span>
        <div class="card-thumb" style="background-image:url('${escapeHtml(it.image)}')"></div>
        <div class="card-name">${escapeHtml(it.name || it.id || it.key)}</div>
        <div class="card-meta">
          ${it.collection ? `<span class="tag tag-collection">${escapeHtml(it.collection)}</span>` : ''}
          ${it.type ? `<span class="tag">${escapeHtml(it.type)}</span>` : ''}
          ${(it.spaces || []).slice(0,3).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}
        </div>
      </div>`;
  }

  function statusLabel(s) {
    switch (s) {
      case 'complete': return 'Completo';
      case 'partial':  return 'Parcial — faltan campos';
      case 'empty':    return 'Vacío — sin metadata';
      case 'removed':  return 'Removido del catálogo';
      default: return '';
    }
  }

  function renderSummary() {
    const total = state.items.length;
    const complete = state.items.filter(i => i.status === 'complete').length;
    const partial  = state.items.filter(i => i.status === 'partial').length;
    const empty    = state.items.filter(i => i.status === 'empty').length;
    const removed  = state.items.filter(i => i.removed).length;
    const showing = getFiltered().length;
    let txt = `${showing} de ${total} · ✓ ${complete} completos · ⚠ ${partial} parciales · ○ ${empty} vacíos`;
    if (removed) txt += ` · — ${removed} removidos`;
    els.summary.textContent = txt;
  }

  function selectCard(key) {
    state.selectedKey = key;
    renderGrid();
    renderSidePanel();
  }

  function renderSidePanel() {
    const it = state.items.find(i => i.key === state.selectedKey);
    if (!it) {
      els.sideEmpty.hidden = false;
      els.sideForm.hidden = true;
      return;
    }
    els.sideEmpty.hidden = true;
    els.sideForm.hidden = false;
    els.sideThumb.style.backgroundImage = `url('${it.image}')`;
    els.sideStatus.className = `status-badge ${it.status}`;
    els.sideStatus.title = statusLabel(it.status);
    els.sideTitle.textContent = it.name || it.id || it.key;
    els.sideImageName.textContent = it.key;
    els.fldName.value = it.name || '';
    els.fldId.value = it.id || '';
    els.fldCatalogId.value = it.catalogId || '';
    els.fldCategory.value = it.category || '';
    els.fldType.value = it.type || '';
    els.fldCollection.value = it.collection || '';
    els.fldStyle.value = it.style || '';
    els.fldImage.value = it.image || '';
    els.fldSpaces.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = (it.spaces || []).includes(cb.value);
    });
  }

  function readFormIntoItem(it) {
    it.name = els.fldName.value.trim();
    it.id = els.fldId.value.trim();
    it.catalogId = els.fldCatalogId.value.trim();
    it.category = els.fldCategory.value.trim();
    it.type = els.fldType.value.trim();
    it.collection = els.fldCollection.value.trim();
    it.style = els.fldStyle.value.trim();
    it.spaces = Array.from(els.fldSpaces.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
    it.status = computeStatus(it);
  }

  function onFormChange() {
    const it = state.items.find(i => i.key === state.selectedKey);
    if (!it) return;
    readFormIntoItem(it);
    persistDraft();
    // Re-render just the changed card + side
    renderGrid();
    // Update side status badge + title in case name changed
    els.sideStatus.className = `status-badge ${it.status}`;
    els.sideTitle.textContent = it.name || it.id || it.key;
  }

  // ---------- Build planner products.json ----------

  function buildExportPayload() {
    return state.items
      .filter(it => !it.removed)
      .map(it => {
        const out = {
          id: it.id || deriveIdFromFilename(it.key),
          name: it.name || cleanName(it.key.replace(/\.[^.]+$/, '')),
          image: it.image
        };
        if (it.catalogId) out.catalogId = it.catalogId;
        if (it.category) out.category = it.category;
        if (it.type) out.type = it.type;
        if (it.collection) out.collection = it.collection;
        if (it.style) out.style = it.style;
        if (Array.isArray(it.spaces) && it.spaces.length) out.spaces = it.spaces.slice();
        return out;
      });
  }

  async function saveToPlanner() {
    const catalogId = state.activeCatalog || DEFAULT_CATALOG_ID;
    const payload = buildExportPayload();
    const ok = window.confirm(
      `Esto va a reemplazar el products.json del planner para "${catalogId}".\n\n` +
      `Productos a guardar: ${payload.length}\n` +
      `Backup automático: products.json.bak.json (en el mismo folder)\n\n` +
      `Continuar?`
    );
    if (!ok) return;

    const path = `space-planner/catalogs/${catalogId}/products.json`;
    try {
      const res = await fetch(`/__save?path=${encodeURIComponent(path)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload, null, 2)
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) {
        toast(`Error al guardar: ${out.error || res.status}`, 'error');
        return;
      }
      // Update baseline so future "Revert" returns here
      state.items.forEach(it => {
        it._baseline = Object.assign({}, it);
        delete it._baseline._baseline;
      });
      // Clear draft since we just persisted
      clearDraft();
      toast(`Guardado en planner: ${payload.length} productos.`, 'success');
    } catch (err) {
      toast(`Error de red al guardar: ${err.message}`, 'error');
    }
  }

  // ---------- Image import (drag-drop + file picker) ----------

  // Filter a FileList/array to image-like files only. We accept by both MIME
  // (image/*) and common extensions (.jpg/.jpeg/.png/.webp/.gif) because some
  // OS contexts don't set MIME on drag-drop.
  function filterImageFiles(fileLike) {
    const arr = Array.from(fileLike || []);
    const extRx = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
    return arr.filter(f => (f.type && f.type.startsWith('image/')) || extRx.test(f.name || ''));
  }

  async function uploadFiles(files) {
    const imgs = filterImageFiles(files);
    if (!imgs.length) {
      toast('No se detectaron imágenes en lo que arrastraste.', 'error');
      return;
    }
    let ok = 0, failed = 0;
    const savedNames = [];
    for (let i = 0; i < imgs.length; i++) {
      const f = imgs[i];
      toast(`Subiendo ${i + 1}/${imgs.length}: ${f.name}…`, '');
      try {
        const dest = `assets/Imagenes/${f.name}`;
        const res = await fetch(`/__upload?path=${encodeURIComponent(dest)}`, {
          method: 'POST',
          headers: { 'Content-Type': f.type || 'application/octet-stream' },
          body: f
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j.ok) {
          ok++;
          savedNames.push(j.savedAs || f.name);
        } else {
          failed++;
          console.error('upload failed', f.name, j);
        }
      } catch (err) {
        failed++;
        console.error('upload error', f.name, err);
      }
    }
    const summary = `Importadas ${ok} imagen${ok === 1 ? '' : 'es'}` +
                    (failed ? ` · ${failed} con error` : '');
    toast(summary, failed ? 'error' : 'success');
    if (ok) {
      await reloadAll();
      // Auto-select the first newly uploaded card so the user can start editing
      if (savedNames[0]) {
        const newKey = savedNames[0];
        if (state.items.some(i => i.key === newKey)) {
          selectCard(newKey);
        }
      }
    }
  }

  function wireImport() {
    if (!els.btnImport) return;
    els.btnImport.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', async (e) => {
      const files = e.target.files;
      e.target.value = ''; // reset so re-selecting same files re-fires change
      if (files && files.length) await uploadFiles(files);
    });

    // Full-page drag-drop. We only show the overlay if the drag carries files.
    let dragDepth = 0;
    function carriesFiles(e) {
      const dt = e.dataTransfer;
      if (!dt) return false;
      const types = dt.types;
      if (!types) return false;
      for (let i = 0; i < types.length; i++) {
        if (types[i] === 'Files') return true;
      }
      return false;
    }
    window.addEventListener('dragenter', (e) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      dragDepth++;
      els.dropOverlay.hidden = false;
    });
    window.addEventListener('dragover', (e) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
    });
    window.addEventListener('dragleave', (e) => {
      if (!carriesFiles(e)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) els.dropOverlay.hidden = true;
    });
    window.addEventListener('drop', async (e) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      dragDepth = 0;
      els.dropOverlay.hidden = true;
      const files = e.dataTransfer.files;
      if (files && files.length) await uploadFiles(files);
    });
  }

  function exportJSON() {
    const payload = buildExportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products.${state.activeCatalog || DEFAULT_CATALOG_ID}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`Descargado ${payload.length} productos.`, 'success');
  }

  function revertSelected() {
    const it = state.items.find(i => i.key === state.selectedKey);
    if (!it || !it._baseline) return;
    Object.assign(it, it._baseline, { _baseline: it._baseline });
    it.status = computeStatus(it);
    persistDraft();
    renderGrid();
    renderSidePanel();
    toast('Cambios revertidos al estado base.', '');
  }

  function toggleRemoveSelected() {
    const it = state.items.find(i => i.key === state.selectedKey);
    if (!it) return;
    it.removed = !it.removed;
    it.status = computeStatus(it);
    persistDraft();
    renderGrid();
    renderSidePanel();
    toast(it.removed ? 'Item removido del catálogo (se va a omitir al guardar).' : 'Item restaurado.', '');
  }

  // ---------- Active catalog resolution + switching ----------

  function resolveInitialCatalogId(availableIds) {
    const fromUrl = new URLSearchParams(location.search).get('catalog');
    if (fromUrl && availableIds.includes(fromUrl)) return fromUrl;
    try {
      const stored = localStorage.getItem(ACTIVE_CATALOG_KEY);
      if (stored && availableIds.includes(stored)) return stored;
    } catch (e) { /* ignore */ }
    if (availableIds.length) return availableIds[0];
    return DEFAULT_CATALOG_ID;
  }

  async function setActiveCatalog(id) {
    if (!id || id === state.activeCatalog) return;
    state.activeCatalog = id;
    try { localStorage.setItem(ACTIVE_CATALOG_KEY, id); } catch (e) { /* ignore */ }
    try {
      const url = new URL(location.href);
      url.searchParams.set('catalog', id);
      history.replaceState(null, '', url.toString());
    } catch (e) { /* ignore */ }
    renderCatalogPicker();
    await reloadAll();
  }

  // ---------- Reload sequence ----------

  async function reloadAll() {
    els.summary.textContent = 'Cargando…';
    const [files, planner] = await Promise.all([
      listImages(),
      loadPlannerProducts(state.activeCatalog)
    ]);
    state.plannerProductsBaseline = planner;
    state.items = buildItems(files, planner);
    const draft = loadDraft();
    if (draft) {
      applyDraftOverlay(state.items, draft);
    }
    // Keep selection if it still exists
    if (state.selectedKey && !state.items.some(i => i.key === state.selectedKey)) {
      state.selectedKey = null;
    }
    renderFilterOptions();
    renderGrid();
    renderSidePanel();
  }

  // ---------- Wiring ----------

  function wireEvents() {
    els.picker.addEventListener('change', (e) => setActiveCatalog(e.target.value));
    els.btnReload.addEventListener('click', () => reloadAll());
    els.btnExport.addEventListener('click', exportJSON);
    els.btnSave.addEventListener('click', saveToPlanner);
    els.btnRevert.addEventListener('click', revertSelected);
    els.btnRemove.addEventListener('click', toggleRemoveSelected);

    els.fSearch.addEventListener('input', () => { state.filters.search = els.fSearch.value; renderGrid(); });
    els.fStatus.addEventListener('change', () => { state.filters.status = els.fStatus.value; renderGrid(); });
    els.fType.addEventListener('change', () => { state.filters.type = els.fType.value; renderGrid(); });
    els.fCollection.addEventListener('change', () => { state.filters.collection = els.fCollection.value; renderGrid(); });
    els.fReset.addEventListener('click', () => {
      state.filters = { search: '', status: '', type: '', collection: '' };
      els.fSearch.value = '';
      els.fStatus.value = '';
      els.fType.value = '';
      els.fCollection.value = '';
      renderGrid();
    });

    // Auto-save form fields on any change
    ['fldName','fldId','fldCatalogId','fldCategory','fldType','fldCollection','fldStyle','fldImage']
      .forEach(k => els[k].addEventListener('input', onFormChange));
    els.fldSpaces.addEventListener('change', onFormChange);
  }

  // ---------- Boot ----------

  (async function boot() {
    wireEvents();
    wireImport();
    await loadCatalogIndex();
    const ids = state.catalogs.map(c => c.id);
    state.activeCatalog = resolveInitialCatalogId(ids);
    try {
      const url = new URL(location.href);
      if (url.searchParams.get('catalog') !== state.activeCatalog) {
        url.searchParams.set('catalog', state.activeCatalog);
        history.replaceState(null, '', url.toString());
      }
    } catch (e) { /* ignore */ }
    renderCatalogPicker();
    await reloadAll();
  })();
})();
