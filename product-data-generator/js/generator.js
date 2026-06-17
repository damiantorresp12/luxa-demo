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
    filters: { search: '', status: '', type: '', collection: '' },
    // catalogIds of products whose image was deleted via "Borrar imagen". Kept
    // here separately from state.items because the item itself disappears on
    // reload (listImages() doesn't see files in _trash/), but the catalogId
    // still needs to go into the sidecar's `removed` array so the app filters
    // the static catalog.data.js entry out.
    removedCatalogIds: []
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
    btnPublish: $('#btn-publish'),
    btnRevert: $('#btn-revert'),
    btnRemove: $('#btn-remove'),
    btnDelete: $('#btn-delete'),
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
    fldCode: $('#fld-code'),
    fldDesigner: $('#fld-designer'),
    fldPower: $('#fld-power'),
    fldLumens: $('#fld-lumens'),
    fldTemperature: $('#fld-temperature'),
    fldCri: $('#fld-cri'),
    fldIp: $('#fld-ip'),
    fldDimensions: $('#fld-dimensions'),
    fldFinish: $('#fld-finish'),
    fldApplicationEs: $('#fld-application-es'),
    fldApplicationEn: $('#fld-application-en'),
    fldDescriptionEs: $('#fld-description-es'),
    fldDescriptionEn: $('#fld-description-en'),
    fldFeatured: $('#fld-featured'),
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

  // Reverse of mapCategoryToType, restricted to the 7 categories the LUXA app
  // actually publishes (see window.LUXA.categories). Used to back-fill the
  // category when only the planner-side `type` is set — same shape as
  // deriveCatalogIdFromName: a sensible default the user can override.
  const TYPE_TO_CATEGORY = {
    pendant: 'Pendants',
    ceiling_light: 'Ceiling Lights',
    wall_light: 'Wall Lights',
    table_lamp: 'Table Lamps',
    floor_lamp: 'Floor Lamps',
    downlight: 'Downlights'
    // spotlight and linear_light have no app-side category — left out on purpose
  };

  function mapTypeToCategory(type) {
    if (!type) return '';
    return TYPE_TO_CATEGORY[type] || '';
  }

  // Best-effort type guess from the product name. Covers the words that show
  // up in the catalog: "pendant", "chandelier", "suspended", "hanging", "wall",
  // "table", "floor", "ceiling", "downlight", "recessed". Returns '' for names
  // that don't match anything obvious (e.g. abstract model codes like "IC F"),
  // so the user can still pick from the select. Order matters — more specific
  // patterns first so e.g. "Suspended" beats a generic "Lamp".
  function deriveTypeFromName(name) {
    if (!name) return '';
    const n = String(name).toLowerCase();
    if (/\bpendant|chandelier|suspended|suspension|hanging\b/.test(n)) return 'pendant';
    if (/\bceiling|flush|surface ceiling\b/.test(n)) return 'ceiling_light';
    if (/\bwall|sconce|aplique\b/.test(n)) return 'wall_light';
    if (/\btable|desk|bedside\b/.test(n)) return 'table_lamp';
    if (/\bfloor|standing\b/.test(n)) return 'floor_lamp';
    if (/\bdownlight|recessed\b/.test(n)) return 'downlight';
    return '';
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

  // Derive a lowercase slug-style catalogId from the product's display name.
  // Strips the "DVA-" prefix so the resulting id matches the curated app-product
  // style (e.g. "aballs-a-wall" rather than "dva-aballs-a-wall"). Used as the
  // automatic default when the user hasn't provided one explicitly.
  function deriveCatalogIdFromName(name) {
    if (!name) return '';
    return String(name)
      .replace(/^DVA[-\s]?/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
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
        code: it.code,
        designer: it.designer,
        power: it.power,
        lumens: it.lumens,
        temperature: it.temperature,
        cri: it.cri,
        ip: it.ip,
        dimensions: it.dimensions,
        finish: it.finish,
        application: it.application,
        description: it.description,
        featured: it.featured,
        removed: it.removed
      }));
      localStorage.setItem(storageKey(), JSON.stringify({
        catalog: state.activeCatalog,
        savedAt: new Date().toISOString(),
        items: payload,
        removedCatalogIds: state.removedCatalogIds.slice()
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

  // Read the `removed` array from the app's currently-published sidecar so a
  // republish doesn't drop catalogIds whose images were already trashed in a
  // past session (those items no longer exist in state.items, so they would
  // otherwise vanish from `removed` on the next publish and reappear in the app).
  async function loadPublishedRemovedIds(catalogId) {
    try {
      const res = await fetch(`../data/products.${catalogId}.json`, { cache: 'no-store' });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json && json.removed) ? json.removed.slice() : [];
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
        // Rich fields may live in the planner draft (if the user filled them
        // here and "Save to planner"ed). They're persisted in the planner JSON
        // alongside the simple fields.
        Object.assign(item, pickRichFields(fromPlanner));
        // If the app also publishes this product, the app's rich content wins
        // when planner's is empty — that way pre-fill is always best-effort.
        if (fromApp) mergeRichFromApp(item, fromApp);
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
        mergeRichFromApp(item, fromApp);
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
        // Empty rich-field skeleton so the form always has stable shape
        Object.assign(item, emptyRichFields());
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

  // Rich-field helpers: the app's product schema is wider than the planner's,
  // and a publish-to-app payload needs all of it.

  function emptyRichFields() {
    return {
      code: '',
      designer: '',
      power: '',
      lumens: '',
      temperature: '',
      cri: '',
      ip: '',
      dimensions: '',
      finish: '',
      application: { es: '', en: '' },
      description: { es: '', en: '' },
      featured: false
    };
  }

  // Pick rich fields out of a planner product (which may or may not have them).
  function pickRichFields(src) {
    const out = emptyRichFields();
    if (!src) return out;
    ['code','designer','power','lumens','temperature','cri','ip','dimensions','finish']
      .forEach(k => { if (src[k]) out[k] = String(src[k]); });
    if (src.application && typeof src.application === 'object') {
      out.application = { es: src.application.es || '', en: src.application.en || '' };
    }
    if (src.description && typeof src.description === 'object') {
      out.description = { es: src.description.es || '', en: src.description.en || '' };
    }
    out.featured = !!src.featured;
    return out;
  }

  // Merge rich fields from an app product (window.LUXA.products entry) onto an
  // item, only filling empty slots so user edits in the planner aren't clobbered.
  function mergeRichFromApp(item, appProd) {
    if (!appProd) return;
    ['code','designer','power','lumens','temperature','cri','ip','dimensions','finish']
      .forEach(k => { if (!item[k] && appProd[k]) item[k] = String(appProd[k]); });
    item.application = item.application || { es: '', en: '' };
    if (appProd.application && typeof appProd.application === 'object') {
      if (!item.application.es) item.application.es = appProd.application.es || '';
      if (!item.application.en) item.application.en = appProd.application.en || '';
    }
    item.description = item.description || { es: '', en: '' };
    if (appProd.description && typeof appProd.description === 'object') {
      if (!item.description.es) item.description.es = appProd.description.es || '';
      if (!item.description.en) item.description.en = appProd.description.en || '';
    }
    if (item.featured == null) item.featured = !!appProd.featured;
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
        code: d.code ?? item.code,
        designer: d.designer ?? item.designer,
        power: d.power ?? item.power,
        lumens: d.lumens ?? item.lumens,
        temperature: d.temperature ?? item.temperature,
        cri: d.cri ?? item.cri,
        ip: d.ip ?? item.ip,
        dimensions: d.dimensions ?? item.dimensions,
        finish: d.finish ?? item.finish,
        application: d.application && typeof d.application === 'object'
          ? { es: d.application.es || '', en: d.application.en || '' }
          : item.application,
        description: d.description && typeof d.description === 'object'
          ? { es: d.description.es || '', en: d.description.en || '' }
          : item.description,
        featured: typeof d.featured === 'boolean' ? d.featured : item.featured,
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

    // Rich publishing fields
    els.fldCode.value = it.code || '';
    els.fldDesigner.value = it.designer || '';
    els.fldPower.value = it.power || '';
    els.fldLumens.value = it.lumens || '';
    els.fldTemperature.value = it.temperature || '';
    els.fldCri.value = it.cri || '';
    els.fldIp.value = it.ip || '';
    els.fldDimensions.value = it.dimensions || '';
    els.fldFinish.value = it.finish || '';
    const app = it.application || { es: '', en: '' };
    const desc = it.description || { es: '', en: '' };
    els.fldApplicationEs.value = app.es || '';
    els.fldApplicationEn.value = app.en || '';
    els.fldDescriptionEs.value = desc.es || '';
    els.fldDescriptionEn.value = desc.en || '';
    els.fldFeatured.checked = !!it.featured;
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

    // Rich publishing fields
    it.code = els.fldCode.value.trim();
    it.designer = els.fldDesigner.value.trim();
    it.power = els.fldPower.value.trim();
    it.lumens = els.fldLumens.value.trim();
    it.temperature = els.fldTemperature.value.trim();
    it.cri = els.fldCri.value.trim();
    it.ip = els.fldIp.value.trim();
    it.dimensions = els.fldDimensions.value.trim();
    it.finish = els.fldFinish.value.trim();
    it.application = {
      es: els.fldApplicationEs.value.trim(),
      en: els.fldApplicationEn.value.trim()
    };
    it.description = {
      es: els.fldDescriptionEs.value.trim(),
      en: els.fldDescriptionEn.value.trim()
    };
    it.featured = !!els.fldFeatured.checked;

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
        // Rich app-publishing fields persist alongside the planner data so
        // they survive across reloads and feed buildAppPublishPayload().
        ['code','designer','power','lumens','temperature','cri','ip','dimensions','finish']
          .forEach(k => { if (it[k]) out[k] = it[k]; });
        if (it.application && (it.application.es || it.application.en)) {
          out.application = { es: it.application.es || '', en: it.application.en || '' };
        }
        if (it.description && (it.description.es || it.description.en)) {
          out.description = { es: it.description.es || '', en: it.description.en || '' };
        }
        if (it.featured) out.featured = true;
        return out;
      });
  }

  // App publishing: build the per-catalog products sidecar that catalog.data.js
  // fetches and merges into window.LUXA.products.
  //
  // Schema must match the app's product shape (see js/catalog.data.js): every
  // entry includes the full `assets` object so the app's `productCard()` can
  // do `p.assets.image` without null-checks. Empty rich fields are tolerated —
  // the app's detail panel filters empty spec rows.
  function buildAppPublishPayload() {
    const VALID_CATEGORIES = [
      'Pendants','Chandeliers','Floor Lamps','Table Lamps',
      'Wall Lights','Ceiling Lights','Downlights'
    ];
    const items = state.items.filter(it =>
      !it.removed &&
      it.catalogId &&
      it.name &&
      it.category && VALID_CATEGORIES.includes(it.category)
    );
    return items.map(it => {
      // The planner stores image paths relative to the planner folder
      // ("../assets/Imagenes/X.jpg"). The app reads them relative to the
      // project root ("assets/Imagenes/X.jpg"). Reroot now.
      const rootImage = (it.image || '').replace(/^\.\.\//, '');
      return {
        id: it.catalogId,
        code: it.code || '',
        name: it.name,
        category: it.category,
        collection: it.collection || '',
        spaces: Array.isArray(it.spaces) ? it.spaces.slice() : [],
        designer: it.designer || '',
        power: it.power || '',
        lumens: it.lumens || '',
        temperature: it.temperature || '',
        cri: it.cri || '',
        ip: it.ip || '',
        dimensions: it.dimensions || '',
        finish: it.finish || '',
        application: {
          es: (it.application && it.application.es) || '',
          en: (it.application && it.application.en) || ''
        },
        description: {
          es: (it.description && it.description.es) || '',
          en: (it.description && it.description.en) || ''
        },
        featured: !!it.featured,
        assets: {
          image: rootImage,
          model: null,
          gallery: [],
          pdfs: [],
          glb: null, fbx: null, ies: null, dwg: null, bim: null
        }
      };
    });
  }

  // List of catalogIds the user marked as "Quitar del catálogo". The app's
  // merge subtracts these from window.LUXA.products so that products which
  // also exist in the static js/catalog.data.js disappear too — without this,
  // a removed curated product would still show up in the app.
  function buildRemovedIdList() {
    const fromItems = state.items
      .filter(it => it.removed && it.catalogId)
      .map(it => it.catalogId);
    const deletedImages = state.removedCatalogIds || [];
    // De-duplicate. Both sources can contribute the same id (e.g. user marked
    // "Quitar del catálogo" and then later deleted the image).
    return Array.from(new Set([...fromItems, ...deletedImages]));
  }

  // Items the user *intended* to publish (catalogId filled) but that miss
  // a required field. Used to warn before publishing.
  function findIncompletePublishItems() {
    const VALID_CATEGORIES = [
      'Pendants','Chandeliers','Floor Lamps','Table Lamps',
      'Wall Lights','Ceiling Lights','Downlights'
    ];
    return state.items.filter(it => {
      if (it.removed) return false;
      if (!it.catalogId) return false;
      if (!it.name) return true;
      if (!it.category || !VALID_CATEGORIES.includes(it.category)) return true;
      return false;
    });
  }

  async function publishToApp() {
    const catalogId = state.activeCatalog || DEFAULT_CATALOG_ID;
    const plannerPayload = buildExportPayload();
    const appPayload = buildAppPublishPayload();
    const incomplete = findIncompletePublishItems();

    if (!appPayload.length) {
      toast('No hay productos listos para publicar. Asegurate de llenar catalogId, name y category.', 'error');
      return;
    }

    const removedPreview = buildRemovedIdList();
    let confirmMsg =
      `Voy a hacer DOS cosas:\n\n` +
      `1) Guardar al planner: ${plannerPayload.length} productos.\n` +
      `2) Publicar a la app: ${appPayload.length} productos (los que tienen catalogId + name + category).\n\n` +
      `Archivos:\n` +
      `  • space-planner/catalogs/${catalogId}/products.json\n` +
      `  • data/products.${catalogId}.json\n` +
      `Backup automático en ambos.\n\n`;
    if (removedPreview.length) {
      confirmMsg +=
        `🗑 ${removedPreview.length} producto${removedPreview.length === 1 ? '' : 's'} marcado${removedPreview.length === 1 ? '' : 's'} ` +
        `para borrar de la app (van en la lista "removed" del sidecar).\n\n`;
    }
    if (incomplete.length) {
      const names = incomplete.map(it => `  • ${it.name || it.id || it.key}`).join('\n');
      confirmMsg +=
        `⚠ ${incomplete.length} producto${incomplete.length === 1 ? '' : 's'} con catalogId pero datos incompletos ` +
        `(falta name o category válida) — NO se van a publicar:\n${names}\n\n`;
    }
    confirmMsg += `Continuar?`;
    if (!window.confirm(confirmMsg)) return;

    // 1) Save to planner first. If this fails we abort — no point in
    //    publishing an out-of-sync sidecar.
    const plannerPath = `space-planner/catalogs/${catalogId}/products.json`;
    try {
      const res = await fetch(`/__save?path=${encodeURIComponent(plannerPath)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plannerPayload, null, 2)
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) {
        toast(`Error guardando al planner: ${out.error || res.status}`, 'error');
        return;
      }
    } catch (err) {
      toast(`Error de red al guardar al planner: ${err.message}`, 'error');
      return;
    }

    // 2) Publish to app sidecar.
    const appPath = `data/products.${catalogId}.json`;
    const removedIds = buildRemovedIdList();
    const appJson = {
      _readme: 'Producto sidecar para la app LUXA. Generado por el Product Data Generator. Editar a mano sólo si sabés lo que hacés. La lista "removed" indica catalogIds que la app debe filtrar del catálogo estático.',
      catalogId: catalogId,
      exportedAt: new Date().toISOString(),
      products: appPayload,
      removed: removedIds
    };
    try {
      const res = await fetch(`/__save?path=${encodeURIComponent(appPath)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appJson, null, 2)
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) {
        toast(`Planner guardado, pero falló publicar a la app: ${out.error || res.status}`, 'error');
        return;
      }
      // Update baseline so future "Revert" returns here
      state.items.forEach(it => {
        it._baseline = Object.assign({}, it);
        delete it._baseline._baseline;
      });
      clearDraft();
      toast(`Publicado: ${appPayload.length} en la app · ${plannerPayload.length} en el planner.`, 'success');
    } catch (err) {
      toast(`Planner guardado, pero error de red publicando a la app: ${err.message}`, 'error');
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

  async function deleteImageSelected() {
    const it = state.items.find(i => i.key === state.selectedKey);
    if (!it || !it.image) return;
    const rootImage = (it.image || '').replace(/^\.\.\//, '');
    const fileName = rootImage.split('/').pop();
    const ok = window.confirm(
      `¿Borrar la imagen "${fileName}"?\n\n` +
      `La imagen se mueve a una carpeta de papelera (_trash/) dentro de la misma carpeta — la podés recuperar a mano si te arrepentís.\n\n` +
      `Esta acción también saca el producto de la grilla.`
    );
    if (!ok) return;
    els.btnDelete.disabled = true;
    try {
      const res = await fetch(`/__delete?path=${encodeURIComponent(rootImage)}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        toast('No se pudo borrar: ' + (data.error || res.statusText), 'err');
        return;
      }
      const idx = state.items.findIndex(i => i.key === state.selectedKey);
      // Stamp the catalogId before splicing so the app's sidecar can filter
      // this product out of the static catalog.data.js on next publish. Without
      // this, a curated product whose image we just trashed would still render
      // as a broken card in the app.
      if (idx !== -1 && it.catalogId) {
        if (!state.removedCatalogIds.includes(it.catalogId)) {
          state.removedCatalogIds.push(it.catalogId);
        }
      }
      if (idx !== -1) state.items.splice(idx, 1);
      state.selectedKey = null;
      persistDraft();
      renderGrid();
      renderSidePanel();
      toast(`Imagen movida a papelera: ${data.trashedAs}`, '');
    } catch (e) {
      toast('Error de red al borrar: ' + e.message, 'err');
    } finally {
      els.btnDelete.disabled = false;
    }
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
    const [files, planner, publishedRemoved] = await Promise.all([
      listImages(),
      loadPlannerProducts(state.activeCatalog),
      loadPublishedRemovedIds(state.activeCatalog)
    ]);
    state.plannerProductsBaseline = planner;
    state.items = buildItems(files, planner);
    const draft = loadDraft();
    if (draft) {
      applyDraftOverlay(state.items, draft);
      state.removedCatalogIds = Array.isArray(draft.removedCatalogIds)
        ? draft.removedCatalogIds.slice()
        : [];
    } else {
      state.removedCatalogIds = [];
    }
    // Merge in catalogIds that the currently-published sidecar already marks as
    // removed. This preserves "image trashed in a previous session" entries
    // (e.g. Apollo and Ayno) across republish — without this, a publish would
    // overwrite the sidecar with `removed: []` and the curated catalog.data.js
    // entries would reappear as broken cards in the app.
    publishedRemoved.forEach(id => {
      if (id && !state.removedCatalogIds.includes(id)) {
        state.removedCatalogIds.push(id);
      }
    });
    // Auto-fill empty fields after the draft overlay. The user's explicit
    // edits win because the overlay already ran; we only fill what is still
    // blank — except for `category`, which we also replace when the planner
    // JSON has a non-app value (e.g. "pendant" used as a category instead of
    // the proper "Pendants"). Three chained derivations:
    //   • type       ← name keywords ("pendant", "table", "floor", …)
    //   • category   ← TYPE_TO_CATEGORY[type] (when empty or non-app)
    //   • catalogId  ← slug(name)
    // Together they collapse the typical "new image needs N fields" friction
    // for the common case (product name describes what it is).
    const VALID_APP_CATEGORIES = new Set([
      'Pendants','Chandeliers','Floor Lamps','Table Lamps',
      'Wall Lights','Ceiling Lights','Downlights'
    ]);
    state.items.forEach(it => {
      if (!it.type && it.name) {
        it.type = deriveTypeFromName(it.name);
      }
      if (!VALID_APP_CATEGORIES.has(it.category) && it.type) {
        const cat = mapTypeToCategory(it.type);
        if (cat) it.category = cat;
      }
      if (!it.catalogId && it.name) {
        it.catalogId = deriveCatalogIdFromName(it.name);
      }
      it.status = computeStatus(it);
    });
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
    if (els.btnPublish) els.btnPublish.addEventListener('click', publishToApp);
    els.btnRevert.addEventListener('click', revertSelected);
    els.btnRemove.addEventListener('click', toggleRemoveSelected);
    els.btnDelete.addEventListener('click', deleteImageSelected);

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
    [
      'fldName','fldId','fldCatalogId','fldCategory','fldType','fldCollection','fldStyle','fldImage',
      'fldCode','fldDesigner','fldPower','fldLumens','fldTemperature','fldCri','fldIp',
      'fldDimensions','fldFinish',
      'fldApplicationEs','fldApplicationEn','fldDescriptionEs','fldDescriptionEn'
    ].forEach(k => els[k].addEventListener('input', onFormChange));
    els.fldSpaces.addEventListener('change', onFormChange);
    els.fldFeatured.addEventListener('change', onFormChange);
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
