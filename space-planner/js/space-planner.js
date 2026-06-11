/* LUXA Space Planner V1
 * Internal tool — generates Collection Scene suggestions for the Spaces section.
 * Vanilla JS, no dependencies. */

(() => {
  'use strict';

  // ---------- Configuration ----------

  const SPACES = ['living', 'dining', 'bedroom', 'bathroom'];

  const VALID_TYPES = [
    'pendant', 'ceiling_light', 'wall_light',
    'table_lamp', 'floor_lamp',
    'downlight', 'spotlight', 'linear_light'
  ];

  // Each space defines an ordered list of "slots". A slot is a list of
  // acceptable types — the first matching product fills that slot.
  const SPACE_RULES = {
    living: {
      slots: [
        ['pendant', 'ceiling_light', 'linear_light'],
        ['wall_light'],
        ['table_lamp', 'floor_lamp']
      ],
      intent: 'Warm residential lighting collection',
      reasonTemplate: (col) =>
        `Combines ambient, accent and decorative lighting from the ${col} family for a complete and balanced living setup.`
    },
    dining: {
      slots: [
        ['pendant'],
        ['wall_light'],
        ['downlight', 'spotlight']
      ],
      intent: 'Dining focused lighting collection',
      reasonTemplate: (col) =>
        `Pairs a ${col} pendant with wall and accent lighting so the table is the protagonist while the room stays well lit.`
    },
    bedroom: {
      slots: [
        ['ceiling_light', 'pendant'],
        ['wall_light'],
        ['table_lamp']
      ],
      intent: 'Soft and quiet bedroom lighting collection',
      reasonTemplate: (col) =>
        `Brings together general, reading and bedside lighting from the ${col} family for a soft, layered bedroom atmosphere.`
    },
    bathroom: {
      slots: [
        ['ceiling_light', 'downlight'],
        ['wall_light'],
        ['spotlight']
      ],
      intent: 'Clean functional bathroom lighting collection',
      reasonTemplate: (col) =>
        `Covers general, mirror and accent lighting from the ${col} family for a clean, functional bathroom composition.`
    }
  };

  // Role assignment per product type
  const ROLE_MAP = {
    pendant: 'ambient lighting / ceiling fixture',
    ceiling_light: 'ambient lighting / ceiling fixture',
    wall_light: 'wall accent / accent lighting',
    table_lamp: 'decorative lighting / task lighting',
    floor_lamp: 'decorative lighting / support lighting',
    downlight: 'general lighting / ceiling support',
    spotlight: 'accent lighting',
    linear_light: 'architectural lighting / ambient lighting'
  };

  // Hotspot suggested area per (space, type)
  const HOTSPOT_MAP = {
    living: {
      pendant: 'ceiling center / above seating area',
      ceiling_light: 'ceiling center',
      wall_light: 'feature wall',
      table_lamp: 'side table near sofa',
      floor_lamp: 'corner near sofa or reading area',
      downlight: 'recessed ceiling above functional zone',
      spotlight: 'track above accent wall or artwork',
      linear_light: 'ceiling perimeter or wall wash'
    },
    dining: {
      pendant: 'centered above the dining table',
      ceiling_light: 'ceiling center above the table',
      wall_light: 'side wall near the table',
      table_lamp: 'sideboard or buffet',
      floor_lamp: 'corner near sideboard',
      downlight: 'recessed ceiling around the table perimeter',
      spotlight: 'track above accent wall or artwork',
      linear_light: 'ceiling perimeter'
    },
    bedroom: {
      pendant: 'above bed center',
      ceiling_light: 'ceiling center above the bed',
      wall_light: 'above bedside or headboard',
      table_lamp: 'on the bedside table',
      floor_lamp: 'corner near reading chair',
      downlight: 'recessed ceiling around the bed area',
      spotlight: 'track above artwork or dresser',
      linear_light: 'headboard wall wash'
    },
    bathroom: {
      pendant: 'above the vanity',
      ceiling_light: 'ceiling center',
      wall_light: 'next to the mirror',
      table_lamp: 'vanity counter (decorative accent)',
      floor_lamp: 'corner near the bathtub',
      downlight: 'recessed ceiling above vanity and shower',
      spotlight: 'track above mirror or shower',
      linear_light: 'mirror wash or ceiling cove'
    }
  };

  const APP_DESC_MAP = {
    living: 'A warm living setup combining ceiling, wall and decorative lighting in a balanced residential composition.',
    dining: 'A focused dining lighting setup with a centered pendant and supporting wall and accent lights.',
    bedroom: 'A soft bedroom setup mixing general, reading and bedside lighting for a quiet residential atmosphere.',
    bathroom: 'A clean bathroom setup combining ceiling, wall and accent lighting for a functional refined composition.'
  };

  // Versioned localStorage key prefix — bump if state shape changes incompatibly.
  // The active catalog id is appended at runtime so each catalog has its own slot.
  const STORAGE_PREFIX = 'luxa.planner.v1.4';
  const LEGACY_STORAGE_KEY = 'luxa.planner.v1.3';
  const ACTIVE_CATALOG_KEY = 'luxa.planner.activeCatalog';
  const DEFAULT_CATALOG_ID = 'luxa-original';

  function storageKey() {
    return `${STORAGE_PREFIX}.${state.activeCatalog || DEFAULT_CATALOG_ID}`;
  }

  // ---------- State ----------

  const state = {
    products: [],
    filtered: [],
    scenes: [],         // suggested
    approved: [],       // approved scenes
    rejected: new Set(),// sceneIds rejected
    editingId: null,    // when modal is editing an existing scene
    modalSelection: new Set(),
    sceneCounter: 0,
    briefSceneId: null, // scene currently open in the AI Brief modal
    hotspotSceneId: null,
    hotspotSelectedIdx: 0,
    // Multi-catalog
    catalogs: [],       // [{ id, name, description }]
    activeCatalog: null // resolved id of the currently active catalog
  };

  // ---------- DOM ----------

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    grid: $('#product-grid'),
    summary: $('#product-summary'),
    fSpace: $('#filter-space'),
    fCollection: $('#filter-collection'),
    fType: $('#filter-type'),
    fStyle: $('#filter-style'),
    fSearch: $('#filter-search'),
    fReset: $('#filter-reset'),
    btnGenerate: $('#btn-generate'),
    btnManual: $('#btn-manual'),
    btnExport: $('#btn-export'),
    sceneList: $('#scene-list'),
    approvedList: $('#approved-list'),
    suggestedCount: $('#suggested-count'),
    approvedCount: $('#approved-count'),
    validationList: $('#validation-list'),
    modal: $('#modal'),
    modalTitle: $('#modal-title'),
    mName: $('#m-name'),
    mSpace: $('#m-space'),
    mIntent: $('#m-intent'),
    mReason: $('#m-reason'),
    mProducts: $('#m-products'),
    mValidation: $('#m-validation'),
    mSave: $('#m-save'),
    toast: $('#toast'),
    briefModal: $('#brief-modal'),
    briefTitle: $('#brief-modal-title'),
    bAiPrompt: $('#b-aiPrompt'),
    bRender: $('#b-renderBrief'),
    bDesc: $('#b-appDescription'),
    bRoles: $('#b-roles'),
    bHotspots: $('#b-hotspots'),
    bSave: $('#b-save'),
    bRegen: $('#b-regenerate'),
    bCopyPrompt: $('#b-copy-prompt'),
    bCopyRender: $('#b-copy-render'),
    bCopyDesc: $('#b-copy-desc'),
    // Hotspot editor
    hotspotModal: $('#hotspot-modal'),
    hotspotTitle: $('#hotspot-modal-title'),
    hFile: $('#h-file'),
    hPath: $('#h-path'),
    hReset: $('#h-reset'),
    hCanvas: $('#h-canvas'),
    hImg: $('#h-img'),
    hEmpty: $('#h-empty'),
    hDots: $('#h-dots'),
    hProducts: $('#h-products'),
    hSave: $('#h-save'),
    btnExportCatalog: $('#btn-export-catalog'),
    btnClearState: $('#btn-clear-state'),
    catalogPicker: $('#catalog-picker')
  };

  // ---------- Utilities ----------

  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const pad = (n) => String(n).padStart(2, '0');
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const uniq = (arr) => Array.from(new Set(arr));
  const escapeHtml = (str) =>
    String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));

  function toast(msg, isError = false) {
    els.toast.textContent = msg;
    els.toast.classList.remove('hidden', 'error');
    if (isError) els.toast.classList.add('error');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.add('hidden'), 2800);
  }

  // ---------- Persistence (localStorage) ----------

  // Serialize a scene without productObjects (they contain image data) — keep only ids.
  function stripScene(scene) {
    const copy = Object.assign({}, scene);
    copy._productIds = (scene.productObjects || []).map(p => p.id);
    delete copy.productObjects;
    return copy;
  }

  // Re-attach productObjects from current state.products. Drops products that no
  // longer exist (e.g. if products.json changed since the state was saved).
  function rehydrateScene(scene) {
    const ids = scene._productIds || [];
    const productObjects = ids
      .map(id => state.products.find(p => p.id === id))
      .filter(Boolean);
    const copy = Object.assign({}, scene, { productObjects });
    delete copy._productIds;
    return copy;
  }

  function saveState() {
    try {
      const key = storageKey();
      const payload = {
        version: key,
        catalog: state.activeCatalog,
        savedAt: new Date().toISOString(),
        scenes: state.scenes.map(stripScene),
        approved: state.approved.map(stripScene),
        rejected: [...state.rejected],
        sceneCounter: state.sceneCounter
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (e) {
      // QuotaExceededError or privacy mode — fail silently, don't break the app
      console.warn('Space Planner: could not persist state', e);
    }
  }

  function loadState() {
    try {
      const key = storageKey();
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== key) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function clearSavedState() {
    try { localStorage.removeItem(storageKey()); }
    catch (e) { /* ignore */ }
  }

  // One-time migration: copy old v1.3 single-slot state into the default
  // catalog's new v1.4 slot. Leaves the legacy key intact so users can rollback
  // by reverting the code if anything goes wrong.
  function migrateLegacyStateIfNeeded() {
    try {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacyRaw) return;
      const newKey = `${STORAGE_PREFIX}.${DEFAULT_CATALOG_ID}`;
      if (localStorage.getItem(newKey)) return; // already migrated
      const legacy = JSON.parse(legacyRaw);
      if (!legacy) return;
      const migrated = Object.assign({}, legacy, {
        version: newKey,
        catalog: DEFAULT_CATALOG_ID,
        migratedFrom: LEGACY_STORAGE_KEY,
        migratedAt: new Date().toISOString()
      });
      localStorage.setItem(newKey, JSON.stringify(migrated));
      console.info(`[Space Planner] Migrated legacy state ${LEGACY_STORAGE_KEY} → ${newKey}`);
    } catch (e) {
      console.warn('Space Planner: legacy state migration failed', e);
    }
  }

  function restoreFromStorage() {
    const data = loadState();
    if (!data) return false;
    state.scenes      = (data.scenes || []).map(rehydrateScene).filter(s => (s.productObjects || []).length >= 2);
    state.approved    = (data.approved || []).map(rehydrateScene).filter(s => (s.productObjects || []).length >= 2);
    state.rejected    = new Set(data.rejected || []);
    state.sceneCounter = Number(data.sceneCounter) || 0;
    return true;
  }

  // ---------- Catalog manager ----------

  // Resolve which catalog should be active on boot:
  //   1. ?catalog=<id> URL parameter (wins — useful for multi-tab workflows)
  //   2. last used catalog from localStorage
  //   3. first catalog in the index
  //   4. DEFAULT_CATALOG_ID as final fallback
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

  // Load the catalogs.json index and fetch each catalog's meta.json. Catalogs
  // that fail to load (missing folder, broken meta) are logged and skipped so a
  // single bad catalog doesn't break the planner.
  async function loadCatalogIndex() {
    let ids = [];
    try {
      const res = await fetch('catalogs.json', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        ids = Array.isArray(json.catalogs) ? json.catalogs : [];
      }
    } catch (e) {
      console.warn('Could not load catalogs.json — falling back to default catalog only.', e);
    }
    if (!ids.length) ids = [DEFAULT_CATALOG_ID];

    const catalogs = [];
    for (const id of ids) {
      try {
        const res = await fetch(`catalogs/${id}/meta.json`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const meta = await res.json();
        catalogs.push({ id, name: meta.name || id, description: meta.description || '' });
      } catch (e) {
        console.warn(`Catalog "${id}" listed in catalogs.json but its meta.json could not be loaded. Skipping.`, e);
      }
    }
    state.catalogs = catalogs;
    return catalogs;
  }

  // ---------- Load products ----------

  async function loadProducts() {
    const catalogId = state.activeCatalog;
    const path = `catalogs/${catalogId}/products.json`;
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const products = await res.json();
      state.products = Array.isArray(products) ? products : [];
    } catch (err) {
      console.error(`Error loading ${path}`, err);
      els.summary.innerHTML =
        `<span style="color:var(--red)">Could not load <code>${escapeHtml(path)}</code>. Serve this folder via a local HTTP server (file:// will fail due to CORS). Error: ${escapeHtml(err.message)}</span>`;
      state.products = [];
      state.filtered = [];
      renderProductGrid();
      return;
    }
    state.filtered = state.products.slice();
    initFilterOptions();
    renderProductGrid();
    runProductValidations();

    // Restore prior session — must happen AFTER products are loaded so we can
    // rehydrate productObjects by id.
    state.scenes = [];
    state.approved = [];
    state.rejected = new Set();
    state.sceneCounter = 0;
    const restored = restoreFromStorage();
    renderScenes();
    if (restored) {
      const sCount = state.scenes.length;
      const aCount = state.approved.length;
      if (sCount || aCount) {
        toast(`Restored ${aCount} approved + ${sCount} suggested scene${(aCount + sCount) === 1 ? '' : 's'}.`);
      }
    }
  }

  // Switch to a different catalog: clears in-memory state, persists the choice,
  // updates the URL, and triggers a full reload of products + restore from the
  // new catalog's localStorage slot.
  async function setActiveCatalog(id) {
    if (!id || id === state.activeCatalog) return;
    const known = state.catalogs.find(c => c.id === id);
    if (!known) {
      toast(`Unknown catalog: ${id}`, true);
      return;
    }
    state.activeCatalog = id;
    try { localStorage.setItem(ACTIVE_CATALOG_KEY, id); } catch (e) { /* ignore */ }
    // Update URL without reloading
    try {
      const url = new URL(location.href);
      url.searchParams.set('catalog', id);
      history.replaceState(null, '', url.toString());
    } catch (e) { /* ignore */ }
    renderCatalogPicker();
    await loadProducts();
  }

  function initFilterOptions() {
    const collections = uniq(state.products.map(p => p.collection).filter(Boolean)).sort();
    const types = uniq(state.products.map(p => p.type).filter(Boolean)).sort();
    const styles = uniq(state.products.map(p => p.style).filter(Boolean)).sort();
    const spaces = uniq(state.products.flatMap(p => p.spaces || [])).filter(Boolean).sort();

    fillSelect(els.fSpace, spaces);
    fillSelect(els.fCollection, collections);
    fillSelect(els.fType, types);
    fillSelect(els.fStyle, styles);

    // populate manual modal space if it has options beyond defaults
    // (we keep the defaults from HTML)
  }

  function fillSelect(select, options) {
    // keep first option (All)
    const first = select.querySelector('option');
    select.innerHTML = '';
    select.appendChild(first);
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    });
  }

  // ---------- Product grid ----------

  function applyFilters() {
    const sp = els.fSpace.value;
    const col = els.fCollection.value;
    const tp = els.fType.value;
    const st = els.fStyle.value;
    const q = els.fSearch.value.trim().toLowerCase();

    state.filtered = state.products.filter(p => {
      if (sp && !(p.spaces || []).includes(sp)) return false;
      if (col && p.collection !== col) return false;
      if (tp && p.type !== tp) return false;
      if (st && p.style !== st) return false;
      if (q) {
        const hay = `${p.name || ''} ${p.id || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    renderProductGrid();
  }

  function renderProductGrid() {
    els.summary.textContent =
      `${state.filtered.length} of ${state.products.length} products`;
    els.grid.innerHTML = state.filtered.map(productCardHTML).join('');
  }

  function productCardHTML(p) {
    const missingTags = [];
    if (!p.type) missingTags.push('<span class="tag tag-warning">no type</span>');
    if (!p.collection) missingTags.push('<span class="tag tag-warning">no collection</span>');
    if (!p.spaces || !p.spaces.length) missingTags.push('<span class="tag tag-warning">no spaces</span>');
    const img = p.image ? `style="background-image:url('${escapeHtml(p.image)}')"` : '';
    const outOfCatalog = !p.catalogId;
    const outRibbon = outOfCatalog
      ? '<span class="out-of-catalog-ribbon" title="Este producto no está publicado en el catálogo de la app — los hotspots no se van a ver en LUXA.">Fuera de catálogo</span>'
      : '';
    return `
      <div class="product-card${outOfCatalog ? ' is-out-of-catalog' : ''}" title="${escapeHtml(p.id || '')}">
        ${outRibbon}
        <div class="product-thumb" ${img}></div>
        <div class="product-name">${escapeHtml(p.name || p.id || 'Unnamed')}</div>
        <div class="product-meta">
          ${p.collection ? `<span class="tag tag-collection">${escapeHtml(p.collection)}</span>` : ''}
          ${p.type ? `<span class="tag">${escapeHtml(p.type)}</span>` : ''}
          ${p.style ? `<span class="tag">${escapeHtml(p.style)}</span>` : ''}
          ${(p.spaces || []).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}
          ${missingTags.join('')}
        </div>
      </div>`;
  }

  // ---------- Validations ----------

  function runProductValidations() {
    const issues = [];

    // products missing required fields
    state.products.forEach(p => {
      if (!p.type) issues.push({ level: 'warn', msg: `Product <b>${escapeHtml(p.id || p.name)}</b> has no <code>type</code>.` });
      if (!p.collection) issues.push({ level: 'warn', msg: `Product <b>${escapeHtml(p.id || p.name)}</b> has no <code>collection</code>.` });
      if (!p.spaces || !p.spaces.length) issues.push({ level: 'warn', msg: `Product <b>${escapeHtml(p.id || p.name)}</b> has no <code>spaces</code> defined.` });
      if (p.type && !VALID_TYPES.includes(p.type)) {
        issues.push({ level: 'warn', msg: `Product <b>${escapeHtml(p.id || p.name)}</b> uses unknown type <code>${escapeHtml(p.type)}</code>.` });
      }
    });

    // per-space availability
    SPACES.forEach(space => {
      const items = state.products.filter(p => (p.spaces || []).includes(space));
      if (items.length < 2) {
        issues.push({ level: 'err', msg: `Not enough products for space <b>${space}</b> (found ${items.length}).` });
      } else {
        // check that each slot has at least one candidate
        const rules = SPACE_RULES[space];
        rules.slots.forEach((slot, i) => {
          const found = items.some(p => slot.includes(p.type));
          if (!found) {
            issues.push({
              level: 'warn',
              msg: `Space <b>${space}</b> is missing a product of type <code>${slot.join('/')}</code> (slot ${i + 1}).`
            });
          }
        });
      }
    });

    state._productIssues = issues;
    renderAllValidations();
  }

  function runSceneValidations() {
    const issues = [];
    state.approved.forEach(s => {
      if (!s.aiPrompt) {
        issues.push({ level: 'warn', msg: `Approved scene <b>${escapeHtml(s.sceneName)}</b> has no AI Brief generated.` });
      }
      if (!s.appDescription) {
        issues.push({ level: 'warn', msg: `Approved scene <b>${escapeHtml(s.sceneName)}</b> has no App Description.` });
      }
      if (!s.hotspotPlan || !s.hotspotPlan.length) {
        issues.push({ level: 'warn', msg: `Approved scene <b>${escapeHtml(s.sceneName)}</b> has no Hotspot Plan.` });
      } else {
        const total = s.hotspotPlan.length;
        const placed = s.hotspotPlan.filter(h => typeof h.x === 'number' && typeof h.y === 'number').length;
        if (placed === 0) {
          issues.push({ level: 'warn', msg: `Approved scene <b>${escapeHtml(s.sceneName)}</b> has no hotspot coordinates placed.` });
        } else if (placed < total) {
          issues.push({ level: 'warn', msg: `Approved scene <b>${escapeHtml(s.sceneName)}</b> has only ${placed}/${total} hotspot coordinates placed.` });
        }
        if (!s.imagePath) {
          issues.push({ level: 'warn', msg: `Approved scene <b>${escapeHtml(s.sceneName)}</b> has no image path set.` });
        }
      }
      const missingRole = (s.productRoles || []).filter(r => !r.role);
      if ((s.productRoles || []).length < (s.productObjects || s.products || []).length) {
        issues.push({ level: 'warn', msg: `Approved scene <b>${escapeHtml(s.sceneName)}</b> has products without a role assigned.` });
      } else if (missingRole.length) {
        issues.push({ level: 'warn', msg: `Approved scene <b>${escapeHtml(s.sceneName)}</b> has empty role values.` });
      }
    });
    state._sceneIssues = issues;
    renderAllValidations();
  }

  function renderAllValidations() {
    const product = state._productIssues || [];
    const scene = state._sceneIssues || [];
    const all = [...product, ...scene];
    renderValidations(all);
  }

  function renderValidations(issues) {
    if (!issues.length) {
      els.validationList.innerHTML = `<li class="v-ok">All products look healthy.</li>`;
      return;
    }
    els.validationList.innerHTML = issues
      .map(i => `<li class="v-${i.level}">${i.msg}</li>`).join('');
  }

  // ---------- Scene generation ----------

  // Try to fill slots from a pool of items.
  // Greedy: for each slot, pick the first un-used item matching one of the types.
  function buildSceneFromSlots(items, slots) {
    const used = new Set();
    const chosen = [];
    for (const slot of slots) {
      const pick = items.find(p => slot.includes(p.type) && !used.has(p.id));
      if (pick) {
        chosen.push(pick);
        used.add(pick.id);
      }
    }
    return chosen;
  }

  function generateScenes() {
    const scenes = [];
    state.sceneCounter = 0;

    for (const space of SPACES) {
      const rules = SPACE_RULES[space];
      const candidates = state.products.filter(p => (p.spaces || []).includes(space));

      // Group by collection
      const byCollection = groupBy(candidates, p => p.collection || '_uncollected');
      const collectionScenes = [];

      for (const [collection, items] of Object.entries(byCollection)) {
        if (collection === '_uncollected') continue;
        const picked = buildSceneFromSlots(items, rules.slots);
        if (picked.length >= 2) {
          collectionScenes.push(makeScene({
            space, collection, products: picked.slice(0, 4),
            sourceMode: 'pure-collection', intent: rules.intent,
            reason: rules.reasonTemplate(collection)
          }));
        }
      }

      // If we have no pure-collection scenes, fall back to style-mix
      if (collectionScenes.length === 0) {
        const byStyle = groupBy(candidates, p => p.style || '_nostyle');
        for (const [style, items] of Object.entries(byStyle)) {
          if (style === '_nostyle') continue;
          const picked = buildSceneFromSlots(items, rules.slots);
          if (picked.length >= 2) {
            const cols = uniq(picked.map(p => p.collection)).join(' + ');
            collectionScenes.push(makeScene({
              space, collection: cap(style) + ' Mix',
              products: picked.slice(0, 4),
              sourceMode: 'style-mix', intent: rules.intent,
              reason: `Mixes pieces from compatible collections (${cols}) that share a ${style} visual language for a coherent ${space} composition.`
            }));
          }
        }
      } else {
        // Also try ONE style-mix per space as an alternative, if it adds variety
        // (only if collection scenes don't already cover all slots completely)
        const allFilled = collectionScenes.some(s => s.products.length === rules.slots.length);
        if (!allFilled) {
          const byStyle = groupBy(candidates, p => p.style || '_nostyle');
          for (const [style, items] of Object.entries(byStyle)) {
            if (style === '_nostyle') continue;
            const picked = buildSceneFromSlots(items, rules.slots);
            if (picked.length === rules.slots.length) {
              const cols = uniq(picked.map(p => p.collection)).join(' + ');
              collectionScenes.push(makeScene({
                space, collection: cap(style) + ' Mix',
                products: picked.slice(0, 4),
                sourceMode: 'style-mix', intent: rules.intent,
                reason: `Mixes pieces from compatible collections (${cols}) that share a ${style} visual language for a coherent ${space} composition.`
              }));
              break;
            }
          }
        }
      }

      scenes.push(...collectionScenes);
    }

    state.scenes = scenes;
    state.rejected.clear();
    renderScenes();
    saveState();

    if (!scenes.length) {
      toast('No scenes could be generated — check Validations panel.', true);
    } else {
      toast(`Generated ${scenes.length} scene${scenes.length === 1 ? '' : 's'}.`);
    }
  }

  function makeScene({ space, collection, products, sourceMode, intent, reason }) {
    state.sceneCounter++;
    const colSlug = slug(collection);
    return {
      sceneId: `${space}_${colSlug}_collection_${pad(state.sceneCounter)}`,
      sceneName: `${cap(space)} ${collection} Collection`,
      sceneMode: 'collection-scene',
      space,
      products: products.map(p => p.name),
      productObjects: products,
      commercialIntent: intent,
      reason,
      status: 'suggested',
      _sourceMode: sourceMode
    };
  }

  function groupBy(arr, fn) {
    const out = {};
    arr.forEach(item => {
      const k = fn(item);
      if (!out[k]) out[k] = [];
      out[k].push(item);
    });
    return out;
  }

  // ---------- Scene rendering ----------

  function renderScenes() {
    els.suggestedCount.textContent = state.scenes.length;
    if (!state.scenes.length) {
      els.sceneList.innerHTML =
        `<p class="muted">No scenes yet. Click <b>Generate Collection Scenes</b> or <b>+ Manual Scene</b>.</p>`;
    } else {
      els.sceneList.innerHTML = state.scenes
        .map(s => sceneCardHTML(s, 'suggested')).join('');
    }
    renderApproved();
    bindSceneActions();
    runSceneValidations();
  }

  function renderApproved() {
    els.approvedCount.textContent = state.approved.length;
    if (!state.approved.length) {
      els.approvedList.innerHTML = `<p class="muted">No approved scenes yet.</p>`;
    } else {
      els.approvedList.innerHTML = state.approved
        .map(s => sceneCardHTML(s, 'approved')).join('');
    }
  }

  function sceneCardHTML(s, mode) {
    const isApproved = mode === 'approved';
    const isRejected = state.rejected.has(s.sceneId);
    const cls = `scene-card${isApproved ? ' approved' : ''}${isRejected ? ' rejected' : ''}`;
    const hasBrief = !!s.aiPrompt;

    const missingCatalog = (s.productObjects || []).filter(p => !p.catalogId);
    const sceneWarning = missingCatalog.length
      ? `<div class="scene-warning" title="${escapeHtml(missingCatalog.map(p => p.name).join(', '))}">⚠ ${missingCatalog.length} producto${missingCatalog.length === 1 ? '' : 's'} fuera de catálogo — los hotspots correspondientes no se van a ver en la app.</div>`
      : '';

    const productsHTML = (s.productObjects || []).map(p => {
      const out = !p.catalogId;
      return `
      <div class="scene-product${out ? ' is-out-of-catalog' : ''}" title="${escapeHtml(p.name)}${out ? ' · Fuera de catálogo' : ''}">
        <div class="product-thumb" ${p.image ? `style="background-image:url('${escapeHtml(p.image)}')"` : ''}></div>
        <div class="pname">${escapeHtml(p.name)}</div>
      </div>`;
    }).join('');

    const briefBtnLabel = hasBrief ? 'Edit AI Brief' : 'Generate AI Brief';
    const quickRow = hasBrief
      ? `<div class="scene-quick">
           <button class="btn-mini" data-act="copy-prompt" data-id="${s.sceneId}">Copy AI Prompt</button>
           <button class="btn-mini" data-act="copy-render" data-id="${s.sceneId}">Copy Render Brief</button>
           <button class="btn-mini" data-act="copy-desc" data-id="${s.sceneId}">Copy App Description</button>
         </div>`
      : '';

    const totalHotspots = (s.hotspotPlan || []).length || (s.productObjects || []).length;
    const placedHotspots = (s.hotspotPlan || []).filter(h => typeof h.x === 'number' && typeof h.y === 'number').length;
    const hotspotBtnLabel = placedHotspots === 0
      ? 'Place Hotspots'
      : (placedHotspots === totalHotspots ? 'Edit Hotspots' : 'Continue Hotspots');

    const actions = isApproved
      ? `<button class="btn btn-edit" data-act="brief" data-id="${s.sceneId}">${briefBtnLabel}</button>
         <button class="btn btn-edit" data-act="hotspots" data-id="${s.sceneId}">${hotspotBtnLabel}</button>
         <button class="btn-edit" data-act="edit" data-id="${s.sceneId}">Edit Scene</button>
         <button class="btn-remove" data-act="remove-approved" data-id="${s.sceneId}">Remove</button>`
      : `<button class="btn btn-approve" data-act="approve" data-id="${s.sceneId}">Approve</button>
         <button class="btn btn-reject" data-act="reject" data-id="${s.sceneId}">Reject</button>
         <button class="btn btn-edit" data-act="edit" data-id="${s.sceneId}">Edit</button>
         <button class="btn btn-edit" data-act="brief" data-id="${s.sceneId}">${briefBtnLabel}</button>
         <button class="btn btn-edit" data-act="hotspots" data-id="${s.sceneId}">${hotspotBtnLabel}</button>`;

    const briefPill = hasBrief
      ? `<span class="brief-pill">AI Brief ✓</span>`
      : '';
    const hotspotPill = totalHotspots
      ? `<span class="hotspot-pill${placedHotspots === totalHotspots ? ' complete' : ''}">Hotspots ${placedHotspots}/${totalHotspots}</span>`
      : '';

    return `
      <div class="${cls}" data-id="${s.sceneId}">
        <div class="scene-head">
          <div>
            <h3 class="scene-title">${escapeHtml(s.sceneName)}</h3>
            <div class="scene-sub">
              <span class="scene-mode">Collection Scene</span>
              <span class="tag">space: ${escapeHtml(s.space)}</span>
              <span class="tag">${(s.productObjects || []).length} products</span>
              ${briefPill}
              ${hotspotPill}
            </div>
          </div>
        </div>
        <div class="scene-products">${productsHTML}</div>
        ${sceneWarning}
        <div class="scene-intent">"${escapeHtml(s.commercialIntent)}"</div>
        <div class="scene-reason">${escapeHtml(s.reason)}</div>
        ${quickRow}
        <div class="scene-actions">${actions}</div>
      </div>`;
  }

  function bindSceneActions() {
    $$('#scene-list [data-act], #approved-list [data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        if (act === 'approve') approveScene(id);
        else if (act === 'reject') rejectScene(id);
        else if (act === 'edit') openEditModal(id);
        else if (act === 'remove-approved') removeApproved(id);
        else if (act === 'brief') openBriefModal(id);
        else if (act === 'hotspots') openHotspotModal(id);
        else if (act === 'copy-prompt') {
          const s = findSceneById(id);
          copyTextToClipboard(s?.aiPrompt || '', 'AI Prompt');
        } else if (act === 'copy-render') {
          const s = findSceneById(id);
          copyTextToClipboard(s?.renderBrief || '', 'Render Brief');
        } else if (act === 'copy-desc') {
          const s = findSceneById(id);
          copyTextToClipboard(s?.appDescription || '', 'App Description');
        }
      });
    });
  }

  function findSceneById(id) {
    return state.scenes.find(s => s.sceneId === id) ||
           state.approved.find(s => s.sceneId === id) || null;
  }

  function approveScene(id) {
    const s = state.scenes.find(x => x.sceneId === id);
    if (!s) return;
    const validation = validateScene(s);
    if (!validation.ok) {
      toast(validation.msg, true);
      return;
    }
    const copy = { ...s, status: 'approved' };
    delete copy._sourceMode;
    state.approved.push(copy);
    state.scenes = state.scenes.filter(x => x.sceneId !== id);
    renderScenes();
    saveState();
    toast(`Approved: ${s.sceneName}`);
  }

  function rejectScene(id) {
    state.rejected.add(id);
    state.scenes = state.scenes.filter(x => x.sceneId !== id);
    renderScenes();
    saveState();
  }

  function removeApproved(id) {
    state.approved = state.approved.filter(x => x.sceneId !== id);
    renderApproved();
    saveState();
  }

  // ---------- Scene validation ----------

  function validateScene(scene) {
    const products = scene.productObjects || [];
    if (products.length < 2) return { ok: false, msg: 'A scene must have at least 2 products.' };
    if (products.length > 4) return { ok: false, msg: 'A scene cannot have more than 4 products.' };

    // all products must share the target space
    const space = scene.space;
    const incompatible = products.filter(p => !(p.spaces || []).includes(space));
    if (incompatible.length) {
      return { ok: false, msg: `Product "${incompatible[0].name}" is not compatible with space "${space}".` };
    }

    // not all same type
    const types = uniq(products.map(p => p.type));
    if (types.length === 1) {
      return { ok: false, msg: `Unbalanced scene: all products are of type "${types[0]}". Add variety.` };
    }

    return { ok: true };
  }

  // ---------- AI Brief generation ----------

  function aiPromptForScene(scene) {
    const products = (scene.productObjects || []).map(p => p.name).join(', ');
    switch (scene.space) {
      case 'living':
        return `Create a premium modern living room scene featuring a coordinated lighting collection. The space includes ${products}. Show a warm, elegant residential atmosphere with a sofa, side table or coffee table, a visible feature wall, dark neutral materials, soft textures and natural wood or stone details. All lighting products should be clearly visible, well integrated into the scene, with balanced protagonism — no single product dominates the others. Camera: wide eye-level interior catalog shot, premium composition, realistic lighting, high-end showroom style.`;
      case 'dining':
        return `Create a premium modern dining room scene featuring a coordinated lighting collection. The space includes ${products}. Show an elegant dining table with chairs, the pendant centered above the table and support lighting from the wall or ceiling. Use warm neutral materials, refined surfaces and a soft ambient mood. All products should be clearly visible with balanced protagonism. Camera: wide eye-level dining catalog shot, premium composition, realistic lighting, high-end showroom style.`;
      case 'bedroom':
        return `Create a premium modern bedroom scene featuring a coordinated lighting collection. The space includes ${products}. Show a calm, warm and quiet atmosphere with a bed, bedside tables, soft textiles and a layered light setup that mixes general, reading and accent lighting. All products should be clearly visible with balanced protagonism. Camera: wide eye-level bedroom catalog shot, premium composition, realistic lighting, high-end showroom style.`;
      case 'bathroom':
        return `Create a premium modern bathroom scene featuring a coordinated lighting collection. The space includes ${products}. Show a clean and functional bathroom with a mirror, vanity or washbasin area, stone or light neutral materials and refined clean lines. The lighting should feel functional yet elegant. All products should be clearly visible with balanced protagonism. Camera: wide eye-level bathroom catalog shot, premium composition, realistic lighting, high-end showroom style.`;
      default:
        return `Create a premium interior scene including ${products}, with balanced protagonism for every product. Wide eye-level catalog shot.`;
    }
  }

  function renderBriefForScene(scene) {
    const placements = (scene.productObjects || [])
      .map(p => {
        const hint = (HOTSPOT_MAP[scene.space] || {})[p.type] || 'in a visible focal area';
        const prep = /^(above|on|in|at|next|centered|under|near|by)\b/i.test(hint) ? '' : 'at the ';
        return `Place the ${p.name} ${prep}${hint}.`;
      })
      .join(' ');
    switch (scene.space) {
      case 'living':
        return `Use a wide eye-level camera showing the full living area. ${placements} Use warm ambient lighting plus accent lighting from the wall and decorative fixtures. Keep all products clearly visible without overcrowding the scene. Avoid extreme angles, hidden fixtures or harsh shadows.`;
      case 'dining':
        return `Use a wide eye-level camera centered on the dining table. ${placements} Use the pendant as the main source and add subtle accent lighting on walls or ceiling. Avoid harsh shadows and keep the table clean and well composed.`;
      case 'bedroom':
        return `Use a wide eye-level camera showing the bed and the bedside area. ${placements} Use soft layered lighting — general ambient, reading and accent. Avoid clinical lighting and overcrowded compositions.`;
      case 'bathroom':
        return `Use a wide eye-level camera showing the vanity / mirror area. ${placements} Use clean functional lighting with subtle accents. Keep materials light and refined and avoid harsh shadows on the mirror.`;
      default:
        return `Use a wide eye-level camera. ${placements} Keep all products clearly visible.`;
    }
  }

  function rolesForScene(scene) {
    return (scene.productObjects || []).map(p => ({
      product: p.name,
      role: ROLE_MAP[p.type] || 'general lighting'
    }));
  }

  function hotspotsForScene(scene) {
    return (scene.productObjects || []).map(p => ({
      product: p.name,
      suggestedArea: (HOTSPOT_MAP[scene.space] || {})[p.type] || 'visible focal area'
    }));
  }

  function generateBrief(scene) {
    scene.aiPrompt = aiPromptForScene(scene);
    scene.renderBrief = renderBriefForScene(scene);
    scene.appDescription = APP_DESC_MAP[scene.space] || '';
    scene.productRoles = rolesForScene(scene);
    scene.hotspotPlan = hotspotsForScene(scene);
  }

  // ---------- AI Brief modal ----------

  function openBriefModal(sceneId) {
    const scene = findSceneById(sceneId);
    if (!scene) return;
    if (!scene.aiPrompt) generateBrief(scene);
    state.briefSceneId = sceneId;

    els.briefTitle.textContent = `AI Brief — ${scene.sceneName}`;
    els.bAiPrompt.value = scene.aiPrompt || '';
    els.bRender.value = scene.renderBrief || '';
    els.bDesc.value = scene.appDescription || '';

    els.bRoles.innerHTML = (scene.productRoles || []).map((r, i) => `
      <div class="brief-row">
        <span class="brief-row-label" title="${escapeHtml(r.product)}">${escapeHtml(r.product)}</span>
        <input type="text" list="role-options" data-brief-role="${i}" value="${escapeHtml(r.role)}" />
      </div>`).join('');

    els.bHotspots.innerHTML = (scene.hotspotPlan || []).map((h, i) => `
      <div class="brief-row">
        <span class="brief-row-label" title="${escapeHtml(h.product)}">${escapeHtml(h.product)}</span>
        <input type="text" data-brief-hotspot="${i}" value="${escapeHtml(h.suggestedArea)}" />
      </div>`).join('');

    els.briefModal.classList.remove('hidden');
  }

  function closeBriefModal() {
    els.briefModal.classList.add('hidden');
    state.briefSceneId = null;
  }

  function saveBriefFromModal() {
    const scene = findSceneById(state.briefSceneId);
    if (!scene) return;
    scene.aiPrompt = els.bAiPrompt.value.trim();
    scene.renderBrief = els.bRender.value.trim();
    scene.appDescription = els.bDesc.value.trim();
    (scene.productRoles || []).forEach((r, i) => {
      const inp = els.bRoles.querySelector(`[data-brief-role="${i}"]`);
      if (inp) r.role = inp.value.trim();
    });
    (scene.hotspotPlan || []).forEach((h, i) => {
      const inp = els.bHotspots.querySelector(`[data-brief-hotspot="${i}"]`);
      if (inp) h.suggestedArea = inp.value.trim();
    });
    closeBriefModal();
    renderScenes();
    saveState();
    toast('AI Brief saved.');
  }

  function regenerateBriefInModal() {
    const scene = findSceneById(state.briefSceneId);
    if (!scene) return;
    generateBrief(scene);
    openBriefModal(state.briefSceneId);
    saveState();
    toast('Brief regenerated from templates.');
  }

  function copyTextToClipboard(text, label = 'Text') {
    if (!text) {
      toast(`${label} is empty.`, true);
      return;
    }
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast(`${label} copied.`); }
      catch (e) { toast(`Could not copy ${label}.`, true); }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => toast(`${label} copied.`))
        .catch(fallback);
    } else {
      fallback();
    }
  }

  // ---------- Manual / Edit modal ----------

  function openManualModal() {
    state.editingId = null;
    els.modalTitle.textContent = 'Manual Collection Scene';
    els.mName.value = '';
    els.mSpace.value = 'living';
    els.mIntent.value = SPACE_RULES.living.intent;
    els.mReason.value = '';
    state.modalSelection = new Set();
    renderModalProducts();
    els.modal.classList.remove('hidden');
    els.mValidation.textContent = '';
  }

  function openEditModal(sceneId) {
    const scene =
      state.scenes.find(s => s.sceneId === sceneId) ||
      state.approved.find(s => s.sceneId === sceneId);
    if (!scene) return;
    state.editingId = sceneId;
    els.modalTitle.textContent = 'Edit Collection Scene';
    els.mName.value = scene.sceneName;
    els.mSpace.value = scene.space;
    els.mIntent.value = scene.commercialIntent;
    els.mReason.value = scene.reason;
    state.modalSelection = new Set((scene.productObjects || []).map(p => p.id));
    renderModalProducts();
    els.modal.classList.remove('hidden');
    els.mValidation.textContent = '';
  }

  function closeModal() {
    els.modal.classList.add('hidden');
    state.editingId = null;
  }

  function renderModalProducts() {
    const space = els.mSpace.value;
    const items = state.products.filter(p => (p.spaces || []).includes(space));
    items.sort((a, b) => (a.collection || '').localeCompare(b.collection || ''));
    els.mProducts.innerHTML = items.map(p => {
      const selected = state.modalSelection.has(p.id) ? ' selected' : '';
      const outOfCatalog = !p.catalogId;
      const outRibbon = outOfCatalog
        ? '<span class="out-of-catalog-ribbon" title="No se va a ver en la app — el producto no está en el catálogo.">Fuera de catálogo</span>'
        : '';
      return `
        <div class="product-card${selected}${outOfCatalog ? ' is-out-of-catalog' : ''}" data-pid="${escapeHtml(p.id)}">
          ${outRibbon}
          <div class="product-thumb" ${p.image ? `style="background-image:url('${escapeHtml(p.image)}')"` : ''}></div>
          <div class="product-name">${escapeHtml(p.name || p.id)}</div>
          <div class="product-meta">
            ${p.collection ? `<span class="tag tag-collection">${escapeHtml(p.collection)}</span>` : ''}
            ${p.type ? `<span class="tag">${escapeHtml(p.type)}</span>` : ''}
          </div>
        </div>`;
    }).join('');
    els.mProducts.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', () => {
        const pid = card.dataset.pid;
        if (state.modalSelection.has(pid)) state.modalSelection.delete(pid);
        else {
          if (state.modalSelection.size >= 4) {
            els.mValidation.textContent = 'Maximum 4 products per scene.';
            return;
          }
          state.modalSelection.add(pid);
        }
        card.classList.toggle('selected');
        els.mValidation.textContent = '';
      });
    });
  }

  function saveModalScene() {
    const name = els.mName.value.trim();
    const space = els.mSpace.value;
    const intent = els.mIntent.value.trim();
    const reason = els.mReason.value.trim();
    const productObjects = state.products.filter(p => state.modalSelection.has(p.id));

    if (!name) return setModalError('Scene name is required.');
    if (productObjects.length < 2) return setModalError('Select at least 2 products.');
    if (productObjects.length > 4) return setModalError('Maximum 4 products per scene.');
    if (!intent) return setModalError('Commercial intent is required.');
    if (!reason) return setModalError('Reason / justification is required.');

    const trial = { space, productObjects };
    const v = validateScene(trial);
    if (!v.ok) return setModalError(v.msg);

    if (state.editingId) {
      // edit existing — find in suggested or approved
      const idx1 = state.scenes.findIndex(s => s.sceneId === state.editingId);
      const idx2 = state.approved.findIndex(s => s.sceneId === state.editingId);
      const list = idx1 >= 0 ? state.scenes : (idx2 >= 0 ? state.approved : null);
      const idx = idx1 >= 0 ? idx1 : idx2;
      if (!list) return setModalError('Scene to edit not found.');
      const target = list[idx];
      target.sceneName = name;
      target.space = space;
      target.commercialIntent = intent;
      target.reason = reason;
      target.products = productObjects.map(p => p.name);
      target.productObjects = productObjects;
      toast(`Updated: ${name}`);
    } else {
      // create new approved scene
      state.sceneCounter++;
      const newScene = {
        sceneId: `${space}_${slug(name)}_manual_${pad(state.sceneCounter)}`,
        sceneName: name,
        sceneMode: 'collection-scene',
        space,
        products: productObjects.map(p => p.name),
        productObjects,
        commercialIntent: intent,
        reason,
        status: 'approved'
      };
      state.approved.push(newScene);
      toast(`Saved approved scene: ${name}`);
    }

    closeModal();
    renderScenes();
    saveState();
  }

  function setModalError(msg) {
    els.mValidation.textContent = msg;
  }

  // ---------- Hotspot editor ----------

  function openHotspotModal(sceneId) {
    const scene = findSceneById(sceneId);
    if (!scene) return;
    // Ensure brief structure exists so we have a hotspotPlan to attach coords to
    if (!scene.hotspotPlan) generateBrief(scene);
    state.hotspotSceneId = sceneId;
    state.hotspotSelectedIdx = 0;

    els.hotspotTitle.textContent = `Place Hotspots — ${scene.sceneName}`;
    els.hPath.value = scene.imagePath || '';
    els.hFile.value = '';
    els.hImg.removeAttribute('src');
    els.hImg.hidden = true;
    els.hEmpty.hidden = false;
    els.hDots.innerHTML = '';

    // If scene already has a path, try loading it directly
    if (scene.imagePath) {
      tryLoadImageFromPath(scene.imagePath);
    }

    renderHotspotProducts();
    els.hotspotModal.classList.remove('hidden');
  }

  function closeHotspotModal() {
    els.hotspotModal.classList.add('hidden');
    state.hotspotSceneId = null;
  }

  function tryLoadImageFromPath(path) {
    // Path is relative to the planner root (space-planner/). Server route depends on
    // whether the planner is served from / or from /space-planner/. We try the
    // catalog-relative path first (../<path>) and fall back to absolute.
    const candidates = [`../${path}`, `/${path}`, path];
    let i = 0;
    const tryNext = () => {
      if (i >= candidates.length) {
        els.hImg.hidden = true;
        els.hEmpty.hidden = false;
        els.hEmpty.textContent = `Could not load "${path}" — load the file manually.`;
        return;
      }
      const url = candidates[i++];
      els.hImg.onload = () => {
        els.hImg.hidden = false;
        els.hEmpty.hidden = true;
        renderHotspotDots();
      };
      els.hImg.onerror = () => tryNext();
      els.hImg.src = url;
    };
    tryNext();
  }

  function renderHotspotProducts() {
    const scene = findSceneById(state.hotspotSceneId);
    if (!scene) return;
    const plan = scene.hotspotPlan || [];
    els.hProducts.innerHTML = plan.map((h, i) => {
      const product = (scene.productObjects || []).find(p => p.name === h.product) || {};
      const thumb = product.image
        ? `<div class="hs-prod-thumb" style="background-image:url('${escapeHtml(product.image)}')"></div>`
        : `<div class="hs-prod-thumb"></div>`;
      const placed = (typeof h.x === 'number' && typeof h.y === 'number');
      const active = (i === state.hotspotSelectedIdx) ? ' active' : '';
      return `
        <div class="hs-prod${active}" data-idx="${i}">
          ${thumb}
          <span class="hs-prod-name">${escapeHtml(h.product)}</span>
          <span class="hs-prod-status${placed ? ' placed' : ''}">${placed ? '✓' : '○'}</span>
        </div>`;
    }).join('');
    els.hProducts.querySelectorAll('.hs-prod').forEach(node => {
      node.addEventListener('click', () => {
        state.hotspotSelectedIdx = Number(node.dataset.idx);
        renderHotspotProducts();
        renderHotspotDots();
      });
    });
    renderHotspotDots();
  }

  function renderHotspotDots() {
    const scene = findSceneById(state.hotspotSceneId);
    if (!scene) return;
    const plan = scene.hotspotPlan || [];
    // Position dots relative to the image's actual bounding box inside the canvas
    const imgRect = els.hImg.getBoundingClientRect();
    const canvasRect = els.hCanvas.getBoundingClientRect();
    if (!imgRect.width) {
      els.hDots.innerHTML = '';
      return;
    }
    const offsetLeft = imgRect.left - canvasRect.left;
    const offsetTop = imgRect.top - canvasRect.top;

    els.hDots.innerHTML = plan.map((h, i) => {
      if (typeof h.x !== 'number' || typeof h.y !== 'number') return '';
      const px = offsetLeft + (h.x / 100) * imgRect.width;
      const py = offsetTop + (h.y / 100) * imgRect.height;
      const active = i === state.hotspotSelectedIdx ? ' active' : '';
      return `<div class="hs-dot${active}" style="left:${px}px;top:${py}px;" data-idx="${i}">
        <span class="hs-dot-label">${escapeHtml(h.product)}</span>
      </div>`;
    }).join('');
  }

  function handleCanvasClick(event) {
    if (els.hImg.hidden) return;
    const scene = findSceneById(state.hotspotSceneId);
    if (!scene) return;
    const plan = scene.hotspotPlan || [];
    if (!plan.length) return;

    const imgRect = els.hImg.getBoundingClientRect();
    const x = event.clientX - imgRect.left;
    const y = event.clientY - imgRect.top;
    // Reject clicks outside the actual image area
    if (x < 0 || y < 0 || x > imgRect.width || y > imgRect.height) return;
    const xPct = +(x / imgRect.width * 100).toFixed(2);
    const yPct = +(y / imgRect.height * 100).toFixed(2);

    plan[state.hotspotSelectedIdx].x = xPct;
    plan[state.hotspotSelectedIdx].y = yPct;

    // Auto-advance to the next un-placed product
    const nextUnplaced = plan.findIndex((h, i) =>
      i > state.hotspotSelectedIdx && (typeof h.x !== 'number' || typeof h.y !== 'number')
    );
    if (nextUnplaced !== -1) state.hotspotSelectedIdx = nextUnplaced;
    renderHotspotProducts();
  }

  function resetHotspotCoords() {
    const scene = findSceneById(state.hotspotSceneId);
    if (!scene || !scene.hotspotPlan) return;
    scene.hotspotPlan.forEach(h => { delete h.x; delete h.y; });
    state.hotspotSelectedIdx = 0;
    renderHotspotProducts();
    saveState();
    toast('Coordinates cleared.');
  }

  function saveHotspots() {
    const scene = findSceneById(state.hotspotSceneId);
    if (!scene) return;
    const path = els.hPath.value.trim();
    if (path) scene.imagePath = path;
    closeHotspotModal();
    renderScenes();
    saveState();
    const placed = (scene.hotspotPlan || []).filter(h => typeof h.x === 'number').length;
    const total = (scene.hotspotPlan || []).length;
    toast(`Saved ${placed}/${total} hotspot coordinates.`);
  }

  function onHotspotFileChange(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      els.hImg.onload = () => {
        els.hImg.hidden = false;
        els.hEmpty.hidden = true;
        renderHotspotDots();
      };
      els.hImg.onerror = () => toast('Could not preview that image.', true);
      els.hImg.src = e.target.result;
    };
    reader.readAsDataURL(file);
    // Auto-fill the path field with a sensible default if it's empty
    if (!els.hPath.value.trim()) {
      els.hPath.value = `assets/Spaces/${file.name}`;
    }
  }

  // ---------- Export ----------

  function exportApproved() {
    if (!state.approved.length) {
      toast('No approved scenes to export.', true);
      return;
    }
    const cleanScenes = state.approved.map(s => ({
      sceneId: s.sceneId,
      sceneName: s.sceneName,
      sceneMode: 'collection-scene',
      space: s.space,
      products: s.products,
      commercialIntent: s.commercialIntent,
      reason: s.reason,
      productRoles: s.productRoles || [],
      aiPrompt: s.aiPrompt || '',
      renderBrief: s.renderBrief || '',
      appDescription: s.appDescription || '',
      imagePath: s.imagePath || '',
      hotspotPlan: (s.hotspotPlan || []).map(h => ({
        product: h.product,
        suggestedArea: h.suggestedArea,
        ...(typeof h.x === 'number' ? { x: h.x } : {}),
        ...(typeof h.y === 'number' ? { y: h.y } : {})
      })),
      status: 'approved'
    }));
    const payload = {
      exportedAt: new Date().toISOString(),
      scenes: cleanScenes
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene_suggestions.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`Exported ${cleanScenes.length} scene${cleanScenes.length === 1 ? '' : 's'}.`);
  }

  // Generates a spaces[] array entry per approved scene shaped for js/catalog.data.js.
  // Product IDs come from the product's optional `catalogId` field; fall back to the
  // planner's own id if not mapped yet.
  function exportCatalogShape() {
    if (!state.approved.length) {
      toast('No approved scenes to export.', true);
      return;
    }
    const productById = id => state.products.find(p => p.id === id);

    const entries = state.approved.map(s => {
      const objs = s.productObjects || [];
      const heroProduct = objs[0] ? (objs[0].catalogId || objs[0].id) : '';
      const hotspots = (s.hotspotPlan || [])
        .filter(h => typeof h.x === 'number' && typeof h.y === 'number')
        .map(h => {
          const product = objs.find(p => p.name === h.product);
          const productId = product ? (product.catalogId || product.id) : h.product;
          return { productId, x: h.x, y: h.y };
        });

      const slug = s.sceneId; // already kebab-ish but uses underscores
      const id = slug.replace(/_/g, '-');

      return {
        id,
        name:        { es: s.sceneName, en: s.sceneName },
        tagline:     { es: s.commercialIntent, en: s.commercialIntent },
        description: { es: s.appDescription || s.reason, en: s.appDescription || s.reason },
        image: s.imagePath || '',
        gallery: s.imagePath ? [s.imagePath] : [],
        heroProduct,
        hotspots
      };
    });

    const placedTotal = entries.reduce((a, e) => a + e.hotspots.length, 0);
    const totalExpected = state.approved.reduce((a, s) => a + (s.hotspotPlan || []).length, 0);

    const catalogId = state.activeCatalog || DEFAULT_CATALOG_ID;
    const filename = `spaces.${catalogId}.json`;

    // Count scenes containing at least one product missing catalogId — those
    // won't render hotspots in the main LUXA app.
    const scenesOutOfCatalog = state.approved.reduce((n, s) => {
      const hasMissing = (s.productObjects || []).some(p => !p.catalogId);
      return n + (hasMissing ? 1 : 0);
    }, 0);

    const payload = {
      _readme: `Auto-managed by the Space Planner. Save this file as data/${filename} in the LUXA project root — the app fetches all data/spaces.*.json files at boot and merges them into window.LUXA.spaces. Same id → planner entry replaces curated entry. Product IDs use catalogId from products.json when present.`,
      catalog: catalogId,
      exportedAt: new Date().toISOString(),
      entries
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const warnSuffix = scenesOutOfCatalog
      ? ` · ⚠ ${scenesOutOfCatalog} con productos fuera de catálogo`
      : '';
    if (placedTotal < totalExpected) {
      toast(`Exported ${filename} — ${placedTotal}/${totalExpected} hotspots placed${warnSuffix}.`);
    } else {
      toast(`Exported ${filename} (${entries.length} ${entries.length === 1 ? 'scene' : 'scenes'})${warnSuffix}.`);
    }
  }

  // ---------- Event wiring ----------

  function wireEvents() {
    [els.fSpace, els.fCollection, els.fType, els.fStyle].forEach(el =>
      el.addEventListener('change', applyFilters));
    els.fSearch.addEventListener('input', applyFilters);
    els.fReset.addEventListener('click', () => {
      els.fSpace.value = '';
      els.fCollection.value = '';
      els.fType.value = '';
      els.fStyle.value = '';
      els.fSearch.value = '';
      applyFilters();
    });

    els.btnGenerate.addEventListener('click', generateScenes);
    els.btnManual.addEventListener('click', openManualModal);
    els.btnExport.addEventListener('click', exportApproved);

    els.mSave.addEventListener('click', saveModalScene);
    els.mSpace.addEventListener('change', () => {
      // refresh suggested intent based on chosen space, only if user hasn't typed one
      const rule = SPACE_RULES[els.mSpace.value];
      if (rule && (!els.mIntent.value || Object.values(SPACE_RULES).some(r => r.intent === els.mIntent.value))) {
        els.mIntent.value = rule.intent;
      }
      // refilter selection (drop products incompatible with new space)
      const allowed = new Set(
        state.products.filter(p => (p.spaces || []).includes(els.mSpace.value)).map(p => p.id)
      );
      state.modalSelection = new Set([...state.modalSelection].filter(id => allowed.has(id)));
      renderModalProducts();
    });

    document.querySelectorAll('[data-close]').forEach(btn =>
      btn.addEventListener('click', closeModal));
    els.modal.addEventListener('click', (e) => {
      if (e.target === els.modal) closeModal();
    });

    // Brief modal events
    document.querySelectorAll('[data-brief-close]').forEach(btn =>
      btn.addEventListener('click', closeBriefModal));
    els.briefModal.addEventListener('click', (e) => {
      if (e.target === els.briefModal) closeBriefModal();
    });
    els.bSave.addEventListener('click', saveBriefFromModal);
    els.bRegen.addEventListener('click', regenerateBriefInModal);
    els.bCopyPrompt.addEventListener('click', () =>
      copyTextToClipboard(els.bAiPrompt.value, 'AI Prompt'));
    els.bCopyRender.addEventListener('click', () =>
      copyTextToClipboard(els.bRender.value, 'Render Brief'));
    els.bCopyDesc.addEventListener('click', () =>
      copyTextToClipboard(els.bDesc.value, 'App Description'));

    // Hotspot editor events
    document.querySelectorAll('[data-hotspot-close]').forEach(btn =>
      btn.addEventListener('click', closeHotspotModal));
    els.hotspotModal.addEventListener('click', (e) => {
      if (e.target === els.hotspotModal) closeHotspotModal();
    });
    els.hFile.addEventListener('change', onHotspotFileChange);
    els.hCanvas.addEventListener('click', handleCanvasClick);
    els.hReset.addEventListener('click', resetHotspotCoords);
    els.hSave.addEventListener('click', saveHotspots);
    window.addEventListener('resize', () => {
      if (!els.hotspotModal.classList.contains('hidden')) renderHotspotDots();
    });

    els.btnExportCatalog.addEventListener('click', exportCatalogShape);

    els.btnClearState.addEventListener('click', () => {
      const total = state.scenes.length + state.approved.length;
      if (total === 0) {
        clearSavedState();
        toast('Saved state cleared.');
        return;
      }
      const ok = window.confirm(
        `This will discard ${state.approved.length} approved + ${state.scenes.length} suggested scenes from the planner (catalog: ${state.activeCatalog}).\n\nApproved scenes already exported to data/spaces.${state.activeCatalog}.json stay in the app.\n\nContinue?`
      );
      if (!ok) return;
      clearSavedState();
      state.scenes = [];
      state.approved = [];
      state.rejected.clear();
      state.sceneCounter = 0;
      renderScenes();
      toast('Saved state cleared.');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!els.modal.classList.contains('hidden')) closeModal();
      else if (!els.briefModal.classList.contains('hidden')) closeBriefModal();
      else if (!els.hotspotModal.classList.contains('hidden')) closeHotspotModal();
    });
  }

  // ---------- Catalog picker UI ----------

  function renderCatalogPicker() {
    const select = els.catalogPicker;
    if (!select) return;
    const cats = state.catalogs || [];
    select.innerHTML = cats.map(c =>
      `<option value="${escapeHtml(c.id)}"${c.id === state.activeCatalog ? ' selected' : ''}>${escapeHtml(c.name)}</option>`
    ).join('');
    // Show/hide the catalog selector area; always visible but disabled if <=1 catalog
    select.disabled = cats.length <= 1;
  }

  function wireCatalogPicker() {
    if (!els.catalogPicker) return;
    els.catalogPicker.addEventListener('change', (e) => {
      setActiveCatalog(e.target.value);
    });
  }

  // ---------- Boot ----------

  (async function boot() {
    wireEvents();
    wireCatalogPicker();
    migrateLegacyStateIfNeeded();
    await loadCatalogIndex();
    const ids = state.catalogs.map(c => c.id);
    state.activeCatalog = resolveInitialCatalogId(ids);
    // Sync the URL so the chosen catalog is bookmarkable
    try {
      const url = new URL(location.href);
      if (url.searchParams.get('catalog') !== state.activeCatalog) {
        url.searchParams.set('catalog', state.activeCatalog);
        history.replaceState(null, '', url.toString());
      }
    } catch (e) { /* ignore */ }
    renderCatalogPicker();
    await loadProducts();
  })();
})();
