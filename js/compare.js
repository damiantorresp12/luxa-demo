/* =============================================================================
   LUXA · Compare Products — compare.js
   Herramienta contextual/global que acompaña al usuario mientras explora.
   Persistencia en localStorage (mismo patrón que Favoritos).
   Máximo 2 productos en V1. Modular para expandir a 3+/PDF/share en el futuro.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'luxa.compare';
  var MAX = 2;

  /* Lookups perezosos a app.js — evitamos capturar refs en tiempo de carga
     porque compare.js puede cargarse antes que app.js termine su init. */
  function App()  { return window.LUXA_App || {}; }
  function Data() { return window.LUXA || {}; }
  function t(k, v)   { return App().t  ? App().t(k, v) : k; }
  function tx(o)     { return App().tx ? App().tx(o)   : (o && (o.es || o.en)) || ''; }
  function productById(id) { return App().productById ? App().productById(id) : null; }
  function isFav(id)       { return App().isFav ? App().isFav(id) : false; }

  /* ---------- persistencia ---------- */
  function loadIds() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function saveIds(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
  }
  function isIn(id) { return loadIds().indexOf(id) !== -1; }
  function count()  { return loadIds().length; }

  /* Toggle: devuelve 'added' | 'removed' | 'limit' | 'noop'.
     'limit' se dispara sólo al INTENTAR sumar un tercero — quitar siempre funciona. */
  function toggle(id) {
    if (!id) return 'noop';
    var list = loadIds();
    var i = list.indexOf(id);
    if (i !== -1) {
      list.splice(i, 1);
      saveIds(list); syncAll();
      return 'removed';
    }
    if (list.length >= MAX) { flashLimit(); return 'limit'; }
    list.push(id);
    saveIds(list); syncAll();
    return 'added';
  }
  function removeId(id) {
    var list = loadIds();
    var i = list.indexOf(id);
    if (i === -1) return;
    list.splice(i, 1);
    saveIds(list); syncAll();
  }
  function clearAll() { saveIds([]); syncAll(); }

  /* ---------- sync UI ---------- */
  function syncAll() {
    updateChip();
    syncButtons();
    var panel = document.getElementById('panel-compare');
    if (panel && !panel.hidden) renderView();
  }

  /* Chip persistente en la topbar. Sólo aparece cuando hay al menos 1 producto
     Y el usuario está en una ruta donde comparar tiene sentido (Productos,
     Ambientes, o la vista Compare misma). En Home / Descargas / Tu Proyecto /
     Acerca queda oculto — esas rutas son de descubrimiento o contenido, no
     de exploración de catálogo. */
  var CHIP_ROUTES = { products: 1, spaces: 1, compare: 1 };
  function currentRoute() {
    var h = (location.hash || '').replace('#', '');
    return h || 'home';
  }
  function updateChip() {
    var chip = document.getElementById('compareChip');
    if (!chip) return;
    var n = count();
    var routeOk = !!CHIP_ROUTES[currentRoute()];
    chip.hidden = (n === 0) || !routeOk;
    var ready = n >= MAX;
    chip.classList.toggle('is-ready', ready);
    chip.setAttribute('aria-disabled', ready ? 'false' : 'true');
    var labelEl = chip.querySelector('.compare-chip-label');
    if (labelEl) labelEl.textContent = t('compare.chip.label');
    var countEl = chip.querySelector('.compare-chip-count');
    if (countEl) countEl.textContent = String(n);
  }

  function syncButtons() {
    var setIds = {};
    loadIds().forEach(function (id) { setIds[id] = true; });
    var all = document.querySelectorAll('.compare-btn[data-id]');
    for (var i = 0; i < all.length; i++) {
      var b = all[i];
      var inList = !!setIds[b.dataset.id];
      b.classList.toggle('is-in', inList);
      b.setAttribute('aria-pressed', String(inList));
      // Aria label & tooltip switch between add/remove
      b.setAttribute('aria-label', t(inList ? 'compare.remove' : 'compare.add'));
      b.setAttribute('title', t(inList ? 'compare.remove' : 'compare.add'));
      // Optional label span (used in detail / hotspot buttons that carry text)
      var lbl = b.querySelector('.compare-btn-label');
      if (lbl) lbl.textContent = t(inList ? 'compare.remove' : 'compare.add');
    }
  }

  /* ---------- toast global (mismo elemento, mensajes distintos) ---------- */
  var toastTimer;
  function flash(msg, ms) {
    var toast = document.getElementById('compareToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-shown');
    }, ms || 2400);
  }
  function flashLimit() {
    flash(t('compare.limit'), 2800);
    var chip = document.getElementById('compareChip');
    if (chip) {
      chip.classList.remove('is-shake');
      void chip.offsetWidth;
      chip.classList.add('is-shake');
    }
  }
  function flashHint() { flash(t('compare.hint.pickSecond'), 2400); }

  /* ---------- chip click ---------- */
  function initChip() {
    var chip = document.getElementById('compareChip');
    if (!chip) return;
    chip.addEventListener('click', function () {
      if (count() < MAX) { flashHint(); return; }
      openView();
    });
  }
  function openView() {
    if (App().go) App().go('compare', { preserveCompare: true });
  }

  /* =============================================================================
     VISTA DE COMPARACIÓN — panel-compare
     ========================================================================== */
  function specRows(p) {
    // Ordenados por prioridad de decisión.
    return [
      { key: 'category',    label: t('detail.category'),    value: p ? t('category.' + p.category) : '' },
      { key: 'collection',  label: t('detail.collection'),  value: p && p.collection ? p.collection : '' },
      { key: 'code',        label: t('detail.code'),        value: p ? p.code : '' },
      { key: 'power',       label: t('detail.power'),       value: p ? p.power : '' },
      { key: 'lumens',      label: t('detail.output'),      value: p ? p.lumens : '' },
      { key: 'temperature', label: t('detail.temp'),        value: p ? p.temperature : '' },
      { key: 'cri',         label: t('detail.cri'),         value: p ? p.cri : '' },
      { key: 'ip',          label: t('detail.ip'),          value: p ? p.ip : '' },
      { key: 'dimensions',  label: t('detail.dimensions'),  value: p ? p.dimensions : '' },
      { key: 'finish',      label: t('detail.finish'),      value: p ? p.finish : '' },
      { key: 'application', label: t('detail.application'), value: p ? tx(p.application) : '' }
    ];
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uri(p) { return encodeURI(p || ''); }

  function productColumnHTML(p, slot) {
    if (!p) {
      return '<article class="compare-col compare-col-empty" data-slot="' + slot + '">' +
        '<div class="compare-empty-inner">' +
          '<span class="compare-empty-plus" aria-hidden="true">+</span>' +
          '<p class="compare-empty-title">' + escapeHTML(t('compare.empty.title')) + '</p>' +
          '<p class="compare-empty-sub">' + escapeHTML(t('compare.empty.sub')) + '</p>' +
          '<button class="btn btn-ghost compare-empty-cta" data-action="pick" type="button">' +
            escapeHTML(t('compare.empty.cta')) +
          '</button>' +
        '</div>' +
      '</article>';
    }
    var favClass = isFav(p.id) ? ' is-fav' : '';
    return '<article class="compare-col" data-slot="' + slot + '" data-id="' + escapeHTML(p.id) + '">' +
      '<header class="compare-col-head">' +
        '<span class="compare-col-cat">' + escapeHTML(t('category.' + p.category)) + '</span>' +
        '<button class="compare-col-remove" data-action="remove" data-id="' + escapeHTML(p.id) + '" type="button" aria-label="' + escapeHTML(t('compare.removeThis')) + '">×</button>' +
      '</header>' +
      '<div class="compare-col-media">' +
        '<img loading="lazy" decoding="async" src="' + uri(p.assets && p.assets.image) + '" alt="' + escapeHTML(p.name) + '" />' +
      '</div>' +
      '<h3 class="compare-col-name">' + escapeHTML(p.name) + '</h3>' +
      (p.designer ? '<p class="compare-col-designer">' + escapeHTML(p.designer) + '</p>' : '') +
      '<div class="compare-col-actions">' +
        '<button class="btn btn-ghost compare-col-detail" data-action="detail" data-id="' + escapeHTML(p.id) + '" type="button">' +
          escapeHTML(t('compare.viewDetail')) +
        '</button>' +
        '<button class="btn btn-ghost compare-col-fav' + favClass + '" data-id="' + escapeHTML(p.id) + '" data-action="fav" type="button" aria-pressed="' + (isFav(p.id) ? 'true' : 'false') + '" aria-label="' + escapeHTML(t(isFav(p.id) ? 'detail.saved' : 'detail.favorite')) + '" title="' + escapeHTML(t(isFav(p.id) ? 'detail.saved' : 'detail.favorite')) + '">' +
          '<span class="heart-empty" aria-hidden="true">♡</span><span class="heart-full" aria-hidden="true">♥</span>' +
        '</button>' +
        '<button class="btn btn-ghost compare-col-replace" data-action="replace" data-id="' + escapeHTML(p.id) + '" type="button">' +
          escapeHTML(t('compare.replace')) +
        '</button>' +
      '</div>' +
    '</article>';
  }

  /* Fila de spec: renderiza ambos valores lado a lado. Compara y marca same/diff. */
  function specRowHTML(rowA, rowB, hasBoth) {
    var aVal = rowA.value || '';
    var bVal = rowB.value || '';
    var norm = function (s) { return String(s).trim().toLowerCase().replace(/\s+/g, ' '); };
    var bothEmpty = !aVal && !bVal;
    if (bothEmpty) return ''; // fila dinámica: si nadie tiene el dato, no se muestra
    var same = hasBoth && aVal && bVal && (norm(aVal) === norm(bVal));
    var diffClass = hasBoth ? (same ? ' is-same' : ' is-diff') : '';
    return '<div class="compare-row' + diffClass + '">' +
      '<div class="compare-row-label">' + escapeHTML(rowA.label || rowB.label) + '</div>' +
      '<div class="compare-row-val" data-slot="0">' + (aVal ? escapeHTML(aVal) : '<span class="compare-dash">—</span>') + '</div>' +
      '<div class="compare-row-val" data-slot="1">' + (bVal ? escapeHTML(bVal) : '<span class="compare-dash">—</span>') + '</div>' +
    '</div>';
  }

  function buildViewHTML(products) {
    var pA = products[0];
    var pB = products[1];
    var rowsA = specRows(pA);
    var rowsB = specRows(pB);
    var hasBoth = !!pA && !!pB;

    var specHTML = '';
    for (var i = 0; i < rowsA.length; i++) {
      specHTML += specRowHTML(rowsA[i], rowsB[i], hasBoth);
    }

    var head = '<header class="compare-head">' +
      '<div class="compare-head-titles">' +
        '<p class="eyebrow">' + escapeHTML(t('compare.eyebrow')) + '</p>' +
        '<h2 class="compare-title">' + escapeHTML(t('compare.title')) + '</h2>' +
        '<p class="compare-sub">' + escapeHTML(t('compare.sub')) + '</p>' +
      '</div>' +
      '<div class="compare-head-actions">' +
        '<button class="btn btn-ghost" data-action="back" type="button">' +
          '<span class="compare-back-arrow" aria-hidden="true">←</span>' +
          '<span>' + escapeHTML(t('compare.backToBrowse')) + '</span>' +
        '</button>' +
        (count() > 0 ? '<button class="btn btn-ghost compare-clear" data-action="clear" type="button">' + escapeHTML(t('compare.clearAll')) + '</button>' : '') +
      '</div>' +
    '</header>';

    var cols = '<div class="compare-cols">' +
      productColumnHTML(pA, '0') +
      productColumnHTML(pB, '1') +
    '</div>';

    var specs = '<div class="compare-specs' + (hasBoth ? '' : ' is-pending') + '">' + specHTML + '</div>';

    var legend = hasBoth
      ? '<p class="compare-legend"><span class="compare-legend-dot is-diff"></span>' + escapeHTML(t('compare.legend.diff')) +
        '<span class="compare-legend-dot is-same"></span>' + escapeHTML(t('compare.legend.same')) + '</p>'
      : '';

    return head + cols + specs + legend;
  }

  function wireViewEvents(panel) {
    // Back
    var backBtn = panel.querySelector('[data-action="back"]');
    if (backBtn) backBtn.addEventListener('click', function () {
      if (App().go) App().go('products');
    });
    // Clear
    var clrBtn = panel.querySelector('[data-action="clear"]');
    if (clrBtn) clrBtn.addEventListener('click', function () { clearAll(); });
    // Remove (X on each column)
    var removeBtns = panel.querySelectorAll('[data-action="remove"]');
    for (var i = 0; i < removeBtns.length; i++) {
      removeBtns[i].addEventListener('click', function (e) {
        removeId(e.currentTarget.dataset.id);
      });
    }
    // Replace: remueve el producto y manda al usuario al catálogo con un hint
    var replaceBtns = panel.querySelectorAll('[data-action="replace"]');
    for (var j = 0; j < replaceBtns.length; j++) {
      replaceBtns[j].addEventListener('click', function (e) {
        removeId(e.currentTarget.dataset.id);
        flash(t('compare.hint.replace'), 3000);
        if (App().go) App().go('products');
      });
    }
    // Ver ficha
    var detailBtns = panel.querySelectorAll('[data-action="detail"]');
    for (var k = 0; k < detailBtns.length; k++) {
      detailBtns[k].addEventListener('click', function (e) {
        if (App().openDetail) App().openDetail(e.currentTarget.dataset.id);
      });
    }
    // Fav toggle (columnas)
    var favBtns = panel.querySelectorAll('[data-action="fav"]');
    for (var m = 0; m < favBtns.length; m++) {
      favBtns[m].addEventListener('click', function (e) {
        var id = e.currentTarget.dataset.id;
        if (App().toggleFav) App().toggleFav(id);
        // Re-render para que la etiqueta "Guardado / Favorito" se actualice
        renderView();
      });
    }
    // Empty column CTA → catálogo
    var pickBtns = panel.querySelectorAll('[data-action="pick"]');
    for (var q = 0; q < pickBtns.length; q++) {
      pickBtns[q].addEventListener('click', function () {
        if (App().go) App().go('products');
      });
    }
  }

  function renderView() {
    var panel = document.getElementById('panel-compare');
    if (!panel) return;
    var ids = loadIds();
    var products = ids.map(productById).filter(Boolean);
    while (products.length < MAX) products.push(null);
    panel.innerHTML = buildViewHTML(products);
    wireViewEvents(panel);
  }

  /* ---------- init ---------- */
  function init() {
    initChip();
    syncAll();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Público — usado por app.js para (a) botones en cards/detail/hotspot,
     (b) renderizar la vista al entrar a la ruta, (c) re-sincronizar tras
     un cambio de idioma. */
  window.LUXA_Compare = {
    toggle: toggle,
    remove: removeId,
    clear: clearAll,
    isIn: isIn,
    count: count,
    render: renderView,
    sync: syncAll
  };
})();
