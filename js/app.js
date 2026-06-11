/* =============================================================================
   LUXA · TD Lighting Experience — app.js (i18n, app-shell)
   Vanilla JS. SPA por show/hide de paneles. El código solo LEE window.LUXA.
   Lenguaje por defecto: ES. Persistencia: localStorage.
   ========================================================================== */
(function () {
  'use strict';

  var DATA = window.LUXA;
  if (!DATA) { console.error('LUXA data not loaded'); return; }

  var FAV_KEY  = 'luxa.favorites';
  var LANG_KEY = 'luxa.lang';

  /* Lenguaje activo. Default 'es'. */
  var lang = 'en';
  try {
    var saved = localStorage.getItem(LANG_KEY);
    lang = (saved === 'en' || saved === 'es') ? saved : 'es';
  } catch (e) { lang = 'es'; }

  /* Mapping ruta → claves de topbar */
  var ROUTES = {
    home:      { eyebrowKey: 'topbar.home.eyebrow',      titleKey: 'topbar.home.title' },
    products:  { eyebrowKey: 'topbar.products.eyebrow',  titleKey: 'topbar.products.title' },
    spaces:    { eyebrowKey: 'topbar.spaces.eyebrow',    titleKey: 'topbar.spaces.title' },
    downloads: { eyebrowKey: 'topbar.downloads.eyebrow', titleKey: 'topbar.downloads.title' },
    favorites: { eyebrowKey: 'topbar.favorites.eyebrow', titleKey: 'topbar.favorites.title' },
    about:     { eyebrowKey: 'topbar.about.eyebrow',     titleKey: 'topbar.about.title' }
  };
  var currentRoute = 'home';

  /* ---------- helpers DOM ---------- */
  function $(s, c)  { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function uri(p) { return encodeURI(p); }
  function productById(id) {
    for (var i = 0; i < DATA.products.length; i++) if (DATA.products[i].id === id) return DATA.products[i];
    return null;
  }

  /* ---------- i18n helpers ----------
     t(key, vars?)  → string desde el diccionario, con sustitución de {n}, etc.
     tx(obj)        → obj puede ser string o { es, en }. Devuelve la versión activa. */
  function t(key, vars) {
    var dict = (DATA.i18n && DATA.i18n[lang]) || {};
    var en   = (DATA.i18n && DATA.i18n.en)   || {};
    var s = dict[key];
    if (s == null) s = en[key];
    if (s == null) s = key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }
  function tx(obj) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj.en || obj.es || '';
  }

  /* Cantidades con plural simple ES/EN: count + key.singular/key.plural */
  function pluralized(key, n) { return t(key + (n === 1 ? '.singular' : '.plural'), { n: n }); }

  /* Aplica strings i18n a nodos estáticos del HTML mediante data-i18n */
  function applyStaticI18n() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(function (n) {
      n.textContent = t(n.dataset.i18n);
    });
    $$('[data-i18n-html]').forEach(function (n) {
      n.innerHTML = t(n.dataset.i18nHtml);
    });
    $$('[data-i18n-placeholder]').forEach(function (n) {
      n.setAttribute('placeholder', t(n.dataset.i18nPlaceholder));
    });
    $$('[data-i18n-aria-label]').forEach(function (n) {
      n.setAttribute('aria-label', t(n.dataset.i18nAriaLabel));
    });
  }

  /* ---------- favorites ---------- */
  function loadFavs() { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch (e) { return []; } }
  function saveFavs(v) { try { localStorage.setItem(FAV_KEY, JSON.stringify(v)); } catch (e) {} }
  function isFav(id) { return loadFavs().indexOf(id) !== -1; }
  function toggleFav(id) {
    var list = loadFavs();
    var i = list.indexOf(id);
    if (i === -1) list.push(id); else list.splice(i, 1);
    saveFavs(list);
    updateFavCount();
    syncFavButtons(id);
    return i === -1;
  }
  function updateFavCount() {
    var n = loadFavs().length;
    var badge = $('#favBadge');
    badge.textContent = n;
    badge.hidden = n === 0;
    var meta = $('#scFavsMeta');
    if (meta) meta.textContent = n === 0 ? t('shortcut.meta.noneYet') : t('shortcut.meta.saved', { n: n });
  }
  function syncFavButtons(id) {
    $$('.fav-btn[data-id="' + id + '"]').forEach(function (b) {
      b.classList.toggle('is-fav', isFav(id));
      b.setAttribute('aria-pressed', isFav(id));
    });
  }

  /* =============================================================================
     LANGUAGE TOGGLE
     ========================================================================== */
  function setLang(newLang) {
    if (newLang !== 'es' && newLang !== 'en') return;
    if (newLang === lang) return;
    lang = newLang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    updateLangToggle();
    applyStaticI18n();
    renderAll();
    // refresh topbar (eyebrow/title + actions) en la ruta actual
    syncTopbar(currentRoute);
  }
  function updateLangToggle() {
    $$('.lang-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.lang === lang);
      b.setAttribute('aria-pressed', b.dataset.lang === lang);
    });
  }

  /* =============================================================================
     ROUTER + topbar
     ========================================================================== */
  function go(route) {
    if (!ROUTES[route]) route = 'home';
    currentRoute = route;

    $$('.panel').forEach(function (p) { p.hidden = p.dataset.screen !== route; });
    $$('.nav-item').forEach(function (b) { b.classList.toggle('active', b.dataset.route === route); });

    syncTopbar(route);

    if (route === 'favorites') renderFavorites();
    if (route === 'home')      refreshHomeMetas();

    closeSidebar();

    if (history.replaceState) history.replaceState(null, '', '#' + route);
    else window.location.hash = route;

    var panels = $('.panels');
    if (panels) panels.scrollTop = 0;
  }

  function syncTopbar(route) {
    var meta = ROUTES[route] || ROUTES.home;
    $('#topbarEyebrow').textContent = t(meta.eyebrowKey);
    $('#topbarTitle').textContent   = t(meta.titleKey);
    renderTopbarActions(route);
  }

  function renderTopbarActions(route) {
    var wrap = $('#topbarActions');
    wrap.innerHTML = '';

    if (route === 'products') {
      var n = visibleProductCount();
      wrap.appendChild(el('span', 'topbar-pill', pluralized('pill.results', n)));
    } else if (route === 'favorites') {
      var favs = loadFavs();
      if (favs.length > 0) {
        var btn = el('button', 'topbar-action', '<span class="topbar-action-label">' + t('action.clearAll') + '</span>');
        btn.addEventListener('click', function () {
          saveFavs([]); updateFavCount(); renderFavorites(); renderTopbarActions('favorites');
        });
        wrap.appendChild(btn);
      } else {
        wrap.appendChild(el('span', 'topbar-pill', t('pill.saved', { n: 0 })));
      }
    } else if (route === 'downloads') {
      wrap.appendChild(el('span', 'topbar-pill', t('pill.files', { n: (DATA.downloads || []).length })));
    }
  }

  /* =============================================================================
     SIDEBAR (mobile drawer)
     ========================================================================== */
  function openSidebar() {
    $('#sidebar').classList.add('open');
    $('#sidebarBackdrop').hidden = false;
    $('#hamburger').classList.add('open');
    $('#hamburger').setAttribute('aria-expanded', 'true');
  }
  function closeSidebar() {
    $('#sidebar').classList.remove('open');
    $('#sidebarBackdrop').hidden = true;
    $('#hamburger').classList.remove('open');
    $('#hamburger').setAttribute('aria-expanded', 'false');
  }

  /* =============================================================================
     HOME — hero + explore by space + quick links
     ========================================================================== */
  function refreshHomeMetas() {
    var pCount = DATA.products.length;
    var mP = $('#scProductsMeta'); if (mP) mP.textContent = t('shortcut.meta.fixtures', { n: pCount });
    updateFavCount();
  }

  /* Editorial split: si el name viene "Living · Aballs Collection",
     el ambiente es el eyebrow y la colección es el título grande.
     Si no respeta el patrón, fallback a name completo como título. */
  function spaceLabels(sp) {
    var name = tx(sp.name);
    var parts = name.split(/\s+·\s+/);
    if (parts.length >= 2) {
      return {
        eyebrow: parts[0].toUpperCase(),
        title:   parts.slice(1).join(' · ')
      };
    }
    return {
      eyebrow: t('homeSpaces.eyebrow').toUpperCase(),
      title:   name
    };
  }

  function renderHomeSpaces() {
    var grid = $('#homeSpacesGrid');
    if (!grid) return;
    var spaces = (DATA.spaces || []).slice(0, 3); // primeras 3 → layout asimétrico
    grid.innerHTML = '';
    if (!spaces.length) {
      grid.hidden = true;
      return;
    }
    grid.hidden = false;

    spaces.forEach(function (sp, i) {
      var labels = spaceLabels(sp);
      var sizeClass = (i === 0) ? 'is-featured' : 'is-secondary';
      var card = el('article', 'space-card ' + sizeClass);
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'link');
      card.setAttribute('aria-label', labels.eyebrow + ' · ' + labels.title);
      card.innerHTML =
        '<div class="space-card-media">' +
          '<img loading="lazy" src="' + uri(sp.image) + '" alt="' + tx(sp.name) + '" />' +
        '</div>' +
        '<div class="space-card-scrim"></div>' +
        '<div class="space-card-body">' +
          '<span class="space-card-eyebrow">' + labels.eyebrow + '</span>' +
          '<h3 class="space-card-title">' + labels.title + '</h3>' +
          '<p class="space-card-tagline">' + tx(sp.tagline) + '</p>' +
          '<span class="space-card-cta">' + t('homeSpaces.cta') + '</span>' +
        '</div>';

      function openSpace() {
        go('spaces');
        setActiveSpace(sp.id);
      }
      card.addEventListener('click', openSpace);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSpace(); }
      });
      grid.appendChild(card);
    });
  }

  /* Bridge: render limpio del producto (catálogo) + close-up del producto (en contexto).
     Puente narrativo entre la card aislada y el ambiente. Click en cada lado abre
     el detalle del producto en el modo correspondiente (catálogo o close-up). */
  function renderHomeBridge() {
    var wrap = $('#homeBridge');
    if (!wrap) return;
    var cfg = DATA.homeBridge || {};
    var p = productById(cfg.productId);
    if (!p) { wrap.hidden = true; wrap.innerHTML = ''; return; }
    wrap.hidden = false;

    var closeUp = cfg.closeUpImage || '';
    var sp = findSpaceFor(p.id);
    var contextLabel = sp ? tx(sp.name) : t('homeBridge.contextLabel');

    wrap.innerHTML =
      '<header class="home-bridge-head">' +
        '<p class="eyebrow">' + t('homeBridge.eyebrow') + '</p>' +
        '<h2 class="home-bridge-title">' + t('homeBridge.title') + '</h2>' +
        '<p class="home-bridge-sub">' + t('homeBridge.sub') + '</p>' +
      '</header>' +
      '<div class="home-bridge-split">' +
        '<figure class="home-bridge-side is-catalog" tabindex="0">' +
          '<div class="home-bridge-media"><img src="' + uri(p.assets.image) + '" alt="' + p.name + '" /></div>' +
          '<figcaption>' +
            '<span class="home-bridge-tag">' + t('homeBridge.catalogLabel') + '</span>' +
            '<span class="home-bridge-name">' + p.name + '</span>' +
          '</figcaption>' +
        '</figure>' +
        '<div class="home-bridge-divider" aria-hidden="true"><span>↔</span></div>' +
        '<figure class="home-bridge-side is-context" tabindex="0">' +
          '<div class="home-bridge-media"><img src="' + (closeUp ? uri(closeUp) : uri(p.assets.image)) + '" alt="' + p.name + '" /></div>' +
          '<figcaption>' +
            '<span class="home-bridge-tag">' + t('homeBridge.contextLabel') + '</span>' +
            '<span class="home-bridge-name">' + contextLabel + '</span>' +
          '</figcaption>' +
        '</figure>' +
      '</div>' +
      '<div class="home-bridge-cta-row">' +
        '<button class="btn btn-ghost" data-route="products" type="button">' + t('homeBridge.cta') + '</button>' +
      '</div>';

    var catalogSide = wrap.querySelector('.home-bridge-side.is-catalog');
    var contextSide = wrap.querySelector('.home-bridge-side.is-context');
    catalogSide.addEventListener('click', function () { openDetail(p.id); });
    if (closeUp) {
      contextSide.addEventListener('click', function () {
        openDetail(p.id, { closeUpImage: closeUp, contextLabel: contextLabel });
      });
    } else {
      contextSide.addEventListener('click', function () { openDetail(p.id); });
    }
  }

  /* CTA cierre comercial: monta el href de WhatsApp con número y mensaje precargado.
     Si no hay número configurado, el botón queda inerte (no abre wa.me con un
     número de juguete que podría hacer ruido). */
  function initHomeCta() {
    var link = $('#homeCtaWhatsapp');
    if (!link) return;
    var num = ((DATA.brand && DATA.brand.contact && DATA.brand.contact.whatsapp) || '').replace(/[^\d]/g, '');
    var msg = t('homeCta.whatsappMsg');
    var PLACEHOLDER = '5491100000000'; // ver brand.contact.whatsapp en catalog.data.js
    if (num && num !== PLACEHOLDER) {
      link.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg);
      link.removeAttribute('aria-disabled');
      link.classList.remove('is-disabled');
      link.onclick = null; // limpia el preventDefault del path placeholder si existía
    } else {
      link.href = '#';
      link.setAttribute('aria-disabled', 'true');
      link.classList.add('is-disabled');
      // Evitar navegación con click cuando el número es placeholder
      link.onclick = function (e) { e.preventDefault(); };
    }
  }

  function initHome() {
    var heroImg = DATA.homeHeroImage;
    if (!heroImg) {
      var fallback = productById('arco-floor') || DATA.products[0];
      if (fallback) heroImg = fallback.assets.image;
    }
    if (heroImg) $('#homeHero').style.backgroundImage = 'url("' + uri(heroImg) + '")';

    renderHomeSpaces();
    renderHomeBridge();
    initHomeCta();
    refreshHomeMetas();
  }

  /* =============================================================================
     PRODUCTS
     ========================================================================== */
  var activeFilter = 'All';
  var searchTerm = '';

  function matchesSearch(p) {
    if (!searchTerm) return true;
    var hay = (p.name + ' ' + p.code + ' ' + p.category + ' ' + (p.designer || '') + ' ' +
               tx(p.description) + ' ' + tx(p.application)).toLowerCase();
    return hay.indexOf(searchTerm) !== -1;
  }
  function filteredProducts() {
    return DATA.products.filter(function (p) {
      return (activeFilter === 'All' || p.category === activeFilter) && matchesSearch(p);
    });
  }
  function visibleProductCount() { return filteredProducts().length; }

  function categoriesInUse() {
    var present = {};
    DATA.products.forEach(function (p) { present[p.category] = true; });
    var ordered = (DATA.categories || []).filter(function (c) { return present[c]; });
    Object.keys(present).forEach(function (c) { if (ordered.indexOf(c) === -1) ordered.push(c); });
    return ['All'].concat(ordered);
  }

  function renderFilters() {
    var wrap = $('#filters');
    wrap.innerHTML = '';
    categoriesInUse().forEach(function (cat) {
      var label = t('category.' + cat);
      var chip = el('button', 'filter-chip' + (cat === activeFilter ? ' active' : ''), label);
      chip.setAttribute('role', 'tab');
      chip.addEventListener('click', function () {
        activeFilter = cat;
        renderFilters();
        renderProducts();
        updateProductCount();
        if ($('#panel-products').hidden === false) renderTopbarActions('products');
      });
      wrap.appendChild(chip);
    });
  }

  function updateProductCount() {
    $('#productCount').textContent = pluralized('products.count', visibleProductCount());
  }

  function productCard(p) {
    var card = el('article', 'card');
    card.setAttribute('tabindex', '0');
    card.innerHTML =
      '<div class="card-media">' +
        '<button class="fav-btn' + (isFav(p.id) ? ' is-fav' : '') + '" data-id="' + p.id + '" aria-label="Toggle favorite" aria-pressed="' + isFav(p.id) + '">' +
          '<span class="heart-empty">♡</span><span class="heart-full">♥</span>' +
        '</button>' +
        '<img loading="lazy" src="' + uri(p.assets.image) + '" alt="' + p.name + '" />' +
      '</div>' +
      '<div class="card-body">' +
        '<span class="card-cat">' + t('category.' + p.category) + '</span>' +
        '<h3 class="card-name">' + p.name + '</h3>' +
        '<span class="card-specs">' + p.power + t('card.specsSep') + p.temperature + '</span>' +
        '<span class="card-view">' + t('products.viewDetails') + '</span>' +
      '</div>';

    card.addEventListener('click', function (e) {
      if (e.target.closest('.fav-btn')) return;
      openDetail(p.id);
    });
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter') openDetail(p.id); });
    $('.fav-btn', card).addEventListener('click', function (e) { e.stopPropagation(); toggleFav(p.id); });
    return card;
  }

  function renderProducts() {
    var grid  = $('#productGrid');
    var empty = $('#productsEmpty');
    grid.innerHTML = '';
    var items = filteredProducts();
    items.forEach(function (p) { grid.appendChild(productCard(p)); });
    if (empty) {
      empty.hidden = items.length > 0;
      grid.hidden  = items.length === 0;
    }
  }

  /* =============================================================================
     PRODUCT DETAIL
     ========================================================================== */
  function openDetail(id, opts) {
    var p = productById(id);
    if (!p) return;
    opts = opts || {};

    var catalogImg = p.assets.image;
    var closeUp    = opts.closeUpImage || null;
    var mainImg    = closeUp || catalogImg;

    $('#detailImg').src = uri(mainImg);
    $('#detailImg').alt = p.name;
    var badge = $('#detailBadge3d');
    badge.hidden = !p.assets.model && !p.assets.glb;
    badge.textContent = t('detail.badge3d');

    // In-context caption: shown when a closeUpImage is available
    var ctx = $('#detailContext');
    if (closeUp && opts.contextLabel) {
      ctx.innerHTML = t('detail.seenIn') + ' <strong>' + opts.contextLabel + '</strong>';
      ctx.hidden = false;
    } else {
      ctx.hidden = true;
      ctx.innerHTML = '';
    }

    // Thumbnail switcher: only shown when both close-up and catalog are available
    var thumbs = $('#detailThumbs');
    if (closeUp) {
      thumbs.innerHTML =
        '<button data-thumb="close" class="active">' +
          '<img src="' + uri(closeUp) + '" alt="" />' +
          '<span class="thumb-label">' + t('detail.viewClose') + '</span>' +
        '</button>' +
        '<button data-thumb="catalog">' +
          '<img src="' + uri(catalogImg) + '" alt="" />' +
          '<span class="thumb-label">' + t('detail.viewCatalog') + '</span>' +
        '</button>';
      thumbs.hidden = false;
      $$('button', thumbs).forEach(function (b) {
        b.addEventListener('click', function () {
          $$('button', thumbs).forEach(function (n) { n.classList.remove('active'); });
          b.classList.add('active');
          var which = b.dataset.thumb;
          var src = which === 'close' ? closeUp : catalogImg;
          $('#detailImg').src = uri(src);
          ctx.hidden = which !== 'close';
        });
      });
    } else {
      thumbs.hidden = true;
      thumbs.innerHTML = '';
    }

    var specs = [
      [t('detail.code'),         p.code],
      [t('detail.category'),     t('category.' + p.category)],
      [t('detail.power'),        p.power],
      [t('detail.output'),       p.lumens],
      [t('detail.temp'),         p.temperature],
      [t('detail.cri'),          p.cri],
      [t('detail.ip'),           p.ip],
      [t('detail.dimensions'),   p.dimensions],
      [t('detail.finish'),       p.finish],
      [t('detail.application'),  tx(p.application)]
    ].filter(function (r) { return r[1]; });

    var rows = specs.map(function (r) {
      return '<div class="spec-row"><span class="spec-key">' + r[0] + '</span><span class="spec-val">' + r[1] + '</span></div>';
    }).join('');

    $('#detailBody').innerHTML =
      '<span class="detail-cat">' + t('category.' + p.category) + '</span>' +
      '<h2 class="detail-name">' + p.name + '</h2>' +
      '<p class="detail-code">' + p.code + '</p>' +
      '<p class="detail-desc">' + tx(p.description) + '</p>' +
      '<div class="spec-table">' + rows + '</div>' +
      '<div class="detail-actions">' +
        '<button class="btn btn-primary" data-action="view-space">' + t('detail.viewInSpace') + '</button>' +
        '<button class="btn btn-ghost" data-action="download-sheet">' + t('detail.downloadSheet') + '</button>' +
        '<button class="btn btn-ghost detail-fav" data-action="fav">' +
          (isFav(p.id) ? t('detail.saved') : t('detail.favorite')) + '</button>' +
      '</div>';

    $('[data-action="view-space"]', $('#detailBody')).addEventListener('click', function () {
      closeDetail();
      go('spaces');
      var sp = findSpaceFor(p.id);
      if (sp) setActiveSpace(sp.id);
    });
    $('[data-action="download-sheet"]', $('#detailBody')).addEventListener('click', function () {
      var dl = (DATA.downloads || [])[0];
      if (dl) triggerDownload(dl.file);
    });
    var favBtn = $('[data-action="fav"]', $('#detailBody'));
    favBtn.addEventListener('click', function () {
      var added = toggleFav(p.id);
      favBtn.textContent = added ? t('detail.saved') : t('detail.favorite');
    });

    $('#detailOverlay').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#detailPanel').scrollTop = 0;
  }

  function closeDetail() {
    $('#detailOverlay').hidden = true;
    document.body.style.overflow = '';
  }

  /* =============================================================================
     SPACES — tabs + stage
     ========================================================================== */
  var activeSpace = null;
  var activeCatalogFilter = null; // null = all catalogs

  function visibleSpaces() {
    var all = DATA.spaces || [];
    if (!activeCatalogFilter) return all;
    return all.filter(function (sp) { return sp._catalog === activeCatalogFilter; });
  }

  function renderCatalogFilter() {
    var wrap = $('#catalogFilter');
    if (!wrap) return;
    var catalogs = DATA.catalogs || [];
    // Only show the filter if there's something to choose between
    if (catalogs.length < 2) {
      wrap.hidden = true;
      wrap.innerHTML = '';
      return;
    }
    wrap.hidden = false;
    wrap.innerHTML = '';

    function makeChip(id, label) {
      var isActive = (id === null && activeCatalogFilter === null) ||
                     (id !== null && activeCatalogFilter === id);
      var chip = el('button', 'catalog-chip' + (isActive ? ' active' : ''), label);
      chip.setAttribute('type', 'button');
      chip.addEventListener('click', function () {
        activeCatalogFilter = id;
        // If the currently-active space is no longer visible, fall back to first visible
        var vs = visibleSpaces();
        if (!vs.some(function (s) { return s.id === activeSpace; })) {
          activeSpace = vs[0] ? vs[0].id : null;
        }
        renderCatalogFilter();
        renderSpaceTabs();
        renderActiveSpace();
      });
      return chip;
    }

    wrap.appendChild(makeChip(null, t('spaces.filter.all') || 'Todos'));
    catalogs.forEach(function (c) {
      wrap.appendChild(makeChip(c.id, c.name));
    });
  }

  function renderSpaceTabs() {
    var wrap = $('#spaceTabs');
    wrap.innerHTML = '';
    visibleSpaces().forEach(function (sp) {
      var tab = el('button', 'space-tab' + (sp.id === activeSpace ? ' active' : ''), tx(sp.name));
      tab.setAttribute('role', 'tab');
      tab.addEventListener('click', function () { setActiveSpace(sp.id); });
      wrap.appendChild(tab);
    });
  }

  function setActiveSpace(id) {
    activeSpace = id;
    renderSpaceTabs();
    renderActiveSpace();
  }

  function renderActiveSpace() {
    var sp = (DATA.spaces || []).filter(function (s) { return s.id === activeSpace; })[0];
    var wrap = $('#spaceStageWrap');
    wrap.innerHTML = '';
    if (!sp) return;

    var hero = productById(sp.heroProduct);
    var bg = sp.image || (hero ? hero.assets.image : '');

    var hotspotsHtml = (sp.hotspots || []).map(function (h) {
      var prod = productById(h.productId);
      if (!prod) return '';
      return '<button class="hotspot" data-id="' + prod.id + '" style="left:' + h.x + '%;top:' + h.y + '%" aria-label="' + prod.name + '">' +
        '<span class="hotspot-label">' + prod.name + '</span></button>';
    }).join('');

    var stage = el('div', 'space-stage');
    stage.innerHTML = (bg ? '<img src="' + uri(bg) + '" alt="' + tx(sp.name) + '" />' : '') + hotspotsHtml;

    var productsList = (sp.hotspots || []).map(function (h) {
      var prod = productById(h.productId);
      if (!prod) return '';
      return '<button class="space-product" data-id="' + prod.id + '">' +
        '<span class="space-product-thumb"><img src="' + uri(prod.assets.image) + '" alt="" /></span>' +
        '<span class="space-product-text">' +
          '<span class="space-product-name">' + prod.name + '</span>' +
          '<span class="space-product-cat">' + t('category.' + prod.category) + '</span>' +
        '</span>' +
        '<span class="space-product-arrow">→</span>' +
      '</button>';
    }).join('');

    var info = el('aside', 'space-info');
    info.innerHTML =
      '<p class="eyebrow">' + t('space.label') + '</p>' +
      '<h3 class="space-name">' + tx(sp.name) + '</h3>' +
      '<p class="space-tagline">' + tx(sp.tagline) + '</p>' +
      '<p class="space-desc">' + tx(sp.description) + '</p>' +
      '<p class="space-products-label">' + t('space.featuredIn') + '</p>' +
      '<div class="space-products">' + productsList + '</div>';

    wrap.appendChild(stage);
    wrap.appendChild(info);

    $$('.hotspot, .space-product', wrap).forEach(function (node) {
      node.addEventListener('click', function () {
        var pid = node.dataset.id;
        var h = (sp.hotspots || []).filter(function (x) { return x.productId === pid; })[0];
        var opts = (h && h.closeUpImage)
          ? { closeUpImage: h.closeUpImage, contextLabel: tx(sp.name) }
          : null;
        openDetail(pid, opts);
      });
    });
  }

  function findSpaceFor(productId) {
    var target = null;
    (DATA.spaces || []).some(function (sp) {
      return (sp.hotspots || []).some(function (h) {
        if (h.productId === productId) { target = sp; return true; }
        return false;
      });
    });
    return target;
  }

  /* =============================================================================
     DOWNLOADS
     ========================================================================== */
  var activeDlFilter = 'All';

  function downloadKinds() {
    var kinds = {};
    (DATA.downloads || []).forEach(function (d) { kinds[d.kind] = true; });
    return ['All'].concat(Object.keys(kinds));
  }
  function dlKindLabel(k) { return k === 'All' ? t('category.All') : t('dl.kind.' + k); }

  function renderDownloadFilters() {
    var wrap = $('#downloadFilters');
    wrap.innerHTML = '';
    downloadKinds().forEach(function (k) {
      var chip = el('button', 'filter-chip' + (k === activeDlFilter ? ' active' : ''), dlKindLabel(k));
      chip.addEventListener('click', function () {
        activeDlFilter = k;
        renderDownloadFilters();
        renderDownloads();
      });
      wrap.appendChild(chip);
    });
  }

  function triggerDownload(file) {
    var a = document.createElement('a');
    a.href = uri(file); a.download = '';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function renderDownloads() {
    var grid = $('#downloadGrid');
    grid.innerHTML = '';
    (DATA.downloads || [])
      .filter(function (d) { return activeDlFilter === 'All' || d.kind === activeDlFilter; })
      .forEach(function (d) {
        var card = el('article', 'dl-card');
        card.innerHTML =
          '<div class="dl-icon">↓</div>' +
          '<span class="dl-kind">' + dlKindLabel(d.kind) + '</span>' +
          '<h3 class="dl-title">' + tx(d.title) + '</h3>' +
          '<p class="dl-desc">' + tx(d.description) + '</p>' +
          '<span class="dl-meta">' + tx(d.pages) + '</span>' +
          '<button class="btn btn-ghost">' + t('downloads.download') + '</button>';
        $('.btn', card).addEventListener('click', function () { triggerDownload(d.file); });
        grid.appendChild(card);
      });
  }

  /* =============================================================================
     FAVORITES
     ========================================================================== */
  function renderFavorites() {
    var grid = $('#favoritesGrid');
    var empty = $('#favoritesEmpty');
    var favs = loadFavs();
    grid.innerHTML = '';

    var items = favs.map(productById).filter(Boolean);
    if (items.length === 0) {
      grid.hidden = true;
      empty.hidden = false;
    } else {
      grid.hidden = false;
      empty.hidden = true;
      items.forEach(function (p) { grid.appendChild(productCard(p)); });
    }
    if ($('#panel-favorites').hidden === false) renderTopbarActions('favorites');
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('#favoritesGrid .fav-btn')) return;
    setTimeout(renderFavorites, 0);
  });

  /* =============================================================================
     ABOUT
     ========================================================================== */
  function renderAbout() {
    $('#aboutIntro').textContent = tx(DATA.about.intro);
    var grid = $('#aboutGrid');
    grid.innerHTML = '';
    DATA.about.pillars.forEach(function (pl) {
      grid.appendChild(el('div', 'about-item',
        '<h3>' + tx(pl.title) + '</h3><p>' + tx(pl.text) + '</p>'));
    });
  }

  /* =============================================================================
     Render-all (lo que cambia al cambiar de idioma)
     ========================================================================== */
  function renderAll() {
    initHome();
    renderFilters();
    renderProducts();
    updateProductCount();
    renderDownloadFilters();
    renderDownloads();
    renderCatalogFilter();
    renderSpaceTabs();
    renderActiveSpace();
    renderAbout();
    updateFavCount();
  }

  /* =============================================================================
     EVENTS / INIT
     ========================================================================== */
  function bindGlobalNav() {
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-route]');
      if (trigger) { e.preventDefault(); go(trigger.dataset.route); }
    });

    $$('[data-close-detail]').forEach(function (n) { n.addEventListener('click', closeDetail); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('#detailOverlay').hidden) closeDetail();
        else if ($('#sidebar').classList.contains('open')) closeSidebar();
      }
    });

    $('#hamburger').addEventListener('click', function () {
      if ($('#sidebar').classList.contains('open')) closeSidebar(); else openSidebar();
    });
    $('#sidebarBackdrop').addEventListener('click', closeSidebar);

    window.addEventListener('hashchange', function () {
      go((window.location.hash || '').replace('#', ''));
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 860) closeSidebar();
    });

    // Products search
    var searchInput = $('#productSearch');
    var searchClear = $('#productSearchClear');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        searchTerm = (this.value || '').trim().toLowerCase();
        if (searchClear) searchClear.hidden = searchTerm.length === 0;
        renderProducts();
        updateProductCount();
        if ($('#panel-products').hidden === false) renderTopbarActions('products');
      });
    }
    if (searchClear) {
      searchClear.addEventListener('click', function () {
        searchInput.value = '';
        searchTerm = '';
        this.hidden = true;
        renderProducts();
        updateProductCount();
        renderTopbarActions('products');
        searchInput.focus();
      });
    }

    // Language toggle
    $$('.lang-btn').forEach(function (b) {
      b.addEventListener('click', function () { setLang(this.dataset.lang); });
    });
  }

  function init() {
    activeSpace = (DATA.spaces && DATA.spaces[0] && DATA.spaces[0].id) || null;

    applyStaticI18n();
    updateLangToggle();
    renderAll();
    bindGlobalNav();

    var start = (window.location.hash || '').replace('#', '');
    go(ROUTES[start] ? start : 'home');
  }

  /* =============================================================================
     Refresh hook — called by catalog.data.js after dynamic data merges
     ========================================================================== */
  window.LUXA_App = {
    refreshSpaces: function () {
      // If no space is active, activate the first one; otherwise re-render current
      if (!activeSpace && DATA.spaces && DATA.spaces.length) {
        activeSpace = DATA.spaces[0].id;
      }
      renderCatalogFilter();
      renderSpaceTabs();
      renderActiveSpace();
      // Home cards también dependen de DATA.spaces (cargado async)
      renderHomeSpaces();
      // Bridge necesita findSpaceFor() para el caption "En contexto"
      renderHomeBridge();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
