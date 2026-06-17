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
  function go(route, opts) {
    opts = opts || {};
    if (!ROUTES[route]) route = 'home';
    currentRoute = route;

    $$('.panel').forEach(function (p) { p.hidden = p.dataset.screen !== route; });
    $$('.nav-item').forEach(function (b) { b.classList.toggle('active', b.dataset.route === route); });

    syncTopbar(route);

    if (route === 'favorites') renderFavorites();
    if (route === 'home')      refreshHomeMetas();
    if (route === 'spaces' && !opts.preserveSpace) {
      // Generic navigation into Spaces lands on the room-type chooser.
      // Callers that already targeted a specific scene pass preserveSpace: true.
      activeSpace = null;
      activeSpaceFilters = { spaces: [], collections: [] };
      renderSpaceSide();
      renderActiveSpace();
    }

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
        setActiveSpace(sp.id);
        go('spaces', { preserveSpace: true });
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
        openDetail(p.id, {
          closeUpImage: closeUp,
          contextLabel: contextLabel,
          spaceImage: sp && sp.image ? sp.image : null
        });
      });
    } else {
      contextSide.addEventListener('click', function () { openDetail(p.id); });
    }
  }

  /* Devuelve el número de WhatsApp limpio si está configurado, '' si es el placeholder
     o no está. Compartido por todas las CTAs de WhatsApp (home + consultar precio). */
  function whatsappNumber() {
    var num = ((DATA.brand && DATA.brand.contact && DATA.brand.contact.whatsapp) || '').replace(/[^\d]/g, '');
    var PLACEHOLDER = '5491100000000';
    return (num && num !== PLACEHOLDER) ? num : '';
  }

  /* Construye la URL de wa.me con el mensaje "Consultar precio" para un producto. */
  function quoteUrlForProduct(p) {
    var num = whatsappNumber();
    if (!num || !p) return '';
    var msg = p.code
      ? t('quote.msg',       { name: p.name, code: p.code })
      : t('quote.msgNoCode', { name: p.name });
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg);
  }

  /* SVG inline del icono WhatsApp — mismo trazo que usa el CTA del home. */
  var WA_ICON_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true" class="ico-wa">' +
      '<path d="M20.5 11.5a8.5 8.5 0 1 1-4.1-7.3l4.1-1.1-1.1 4.1a8.5 8.5 0 0 1 1.1 4.3z"/>' +
      '<path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/>' +
    '</svg>';

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
  var activeFilters = { categories: [], spaces: [], collections: [] };
  var searchTerm = '';

  function matchesSearch(p) {
    if (!searchTerm) return true;
    var hay = (p.name + ' ' + p.code + ' ' + p.category + ' ' + (p.designer || '') + ' ' +
               tx(p.description) + ' ' + tx(p.application)).toLowerCase();
    return hay.indexOf(searchTerm) !== -1;
  }
  function filteredProducts() {
    return DATA.products.filter(function (p) {
      if (activeFilters.categories.length && activeFilters.categories.indexOf(p.category) === -1) return false;
      if (activeFilters.spaces.length) {
        var prodSpaces = p.spaces || [];
        var match = false;
        for (var i = 0; i < activeFilters.spaces.length; i++) {
          if (prodSpaces.indexOf(activeFilters.spaces[i]) !== -1) { match = true; break; }
        }
        if (!match) return false;
      }
      if (activeFilters.collections.length && activeFilters.collections.indexOf(p.collection) === -1) return false;
      return matchesSearch(p);
    });
  }
  function visibleProductCount() { return filteredProducts().length; }

  function categoriesInUse() {
    var present = {};
    DATA.products.forEach(function (p) { present[p.category] = true; });
    var ordered = (DATA.categories || []).filter(function (c) { return present[c]; });
    Object.keys(present).forEach(function (c) { if (ordered.indexOf(c) === -1) ordered.push(c); });
    return ordered;
  }
  function spacesInUse() {
    var present = {};
    DATA.products.forEach(function (p) {
      (p.spaces || []).forEach(function (s) { if (s) present[s] = true; });
    });
    var preferredOrder = ['living', 'dining', 'kitchen', 'bedroom', 'bathroom'];
    var ordered = preferredOrder.filter(function (s) { return present[s]; });
    Object.keys(present).forEach(function (s) { if (ordered.indexOf(s) === -1) ordered.push(s); });
    return ordered;
  }
  function collectionsInUse() {
    var present = {};
    DATA.products.forEach(function (p) { if (p.collection) present[p.collection] = true; });
    return Object.keys(present).sort(function (a, b) { return a.localeCompare(b); });
  }

  function toggleFilter(group, value) {
    var arr = activeFilters[group];
    var i = arr.indexOf(value);
    if (i === -1) arr.push(value); else arr.splice(i, 1);
  }
  function clearAllFilters() {
    activeFilters = { categories: [], spaces: [], collections: [] };
  }
  function totalActiveFilters() {
    return activeFilters.categories.length + activeFilters.spaces.length + activeFilters.collections.length;
  }

  function renderFilterGroup(wrap, titleKey, values, group, labelFn) {
    var fs = el('fieldset', 'filter-group');
    var lg = el('legend', 'filter-group-title', t(titleKey));
    fs.appendChild(lg);
    values.forEach(function (val) {
      var labelText = labelFn(val);
      var row = el('label', 'filter-check');
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.value = val;
      input.checked = activeFilters[group].indexOf(val) !== -1;
      input.addEventListener('change', function () {
        toggleFilter(group, val);
        renderProducts();
        updateProductCount();
        renderFilters();
      });
      var span = el('span', 'filter-check-label', labelText);
      row.appendChild(input);
      row.appendChild(span);
      fs.appendChild(row);
    });
    wrap.appendChild(fs);
  }

  function renderFilters() {
    var wrap = $('#filtersSide');
    if (!wrap) return;
    wrap.innerHTML = '';

    var closeBtn = el('button', 'filter-drawer-close', '×');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', t('filters.close'));
    closeBtn.addEventListener('click', function () { closeFiltersDrawer(); });
    wrap.appendChild(closeBtn);

    updateFiltersToggleCount('productsFiltersCount', totalActiveFilters());

    if (totalActiveFilters() > 0) {
      var clearBtn = el('button', 'filter-clear', t('filters.clear') + ' (' + totalActiveFilters() + ')');
      clearBtn.type = 'button';
      clearBtn.addEventListener('click', function () {
        clearAllFilters();
        renderFilters();
        renderProducts();
        updateProductCount();
      });
      wrap.appendChild(clearBtn);
    }

    renderFilterGroup(wrap, 'filters.categories', categoriesInUse(), 'categories', function (c) {
      return t('category.' + c);
    });
    renderFilterGroup(wrap, 'filters.spaces', spacesInUse(), 'spaces', function (s) {
      var key = 'space.' + s;
      var translated = t(key);
      return translated === key ? (s.charAt(0).toUpperCase() + s.slice(1)) : translated;
    });
    renderFilterGroup(wrap, 'filters.collections', collectionsInUse(), 'collections', function (c) {
      return c;
    });
  }

  function updateProductCount() {
    $('#productCount').textContent = pluralized('products.count', visibleProductCount());
  }

  function productCard(p) {
    var card = el('article', 'card');
    card.setAttribute('tabindex', '0');
    var waUrl = quoteUrlForProduct(p);
    var quoteBtn = waUrl
      ? '<a class="card-quote" href="' + waUrl + '" target="_blank" rel="noopener noreferrer" aria-label="' + t('quote.cta') + '">' +
          WA_ICON_SVG + '<span>' + t('quote.cta') + '</span>' +
        '</a>'
      : '';
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
        '<div class="card-foot">' +
          '<span class="card-view">' + t('products.viewDetails') + '</span>' +
          quoteBtn +
        '</div>' +
      '</div>';

    card.addEventListener('click', function (e) {
      if (e.target.closest('.fav-btn')) return;
      if (e.target.closest('.card-quote')) return;
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
    var spaceImg   = opts.spaceImage || null;
    var mainImg    = closeUp || catalogImg;

    $('#detailImg').src = uri(mainImg);
    $('#detailImg').alt = p.name;

    // In-context caption: shown when a closeUpImage is available
    var ctx = $('#detailContext');
    if (closeUp && opts.contextLabel) {
      ctx.innerHTML = t('detail.seenIn') + ' <strong>' + opts.contextLabel + '</strong>';
      ctx.hidden = false;
    } else {
      ctx.hidden = true;
      ctx.innerHTML = '';
    }

    // Mini-gallery switcher: ambient → close-up → catalog. The ambient and
    // close-up thumbs only appear when their respective images are available.
    var thumbs = $('#detailThumbs');
    if (closeUp || spaceImg) {
      var parts = [];
      if (spaceImg) {
        parts.push(
          '<button data-thumb="space">' +
            '<img src="' + uri(spaceImg) + '" alt="" />' +
            '<span class="thumb-label">' + t('detail.viewAmbient') + '</span>' +
          '</button>'
        );
      }
      if (closeUp) {
        parts.push(
          '<button data-thumb="close" class="active">' +
            '<img src="' + uri(closeUp) + '" alt="" />' +
            '<span class="thumb-label">' + t('detail.viewClose') + '</span>' +
          '</button>'
        );
      }
      parts.push(
        '<button data-thumb="catalog"' + (!closeUp ? ' class="active"' : '') + '>' +
          '<img src="' + uri(catalogImg) + '" alt="" />' +
          '<span class="thumb-label">' + t('detail.viewCatalog') + '</span>' +
        '</button>'
      );
      thumbs.innerHTML = parts.join('');
      thumbs.hidden = false;
      $$('button', thumbs).forEach(function (b) {
        b.addEventListener('click', function () {
          $$('button', thumbs).forEach(function (n) { n.classList.remove('active'); });
          b.classList.add('active');
          var which = b.dataset.thumb;
          var src = which === 'close' ? closeUp
                  : which === 'space' ? spaceImg
                  : catalogImg;
          $('#detailImg').src = uri(src);
          // Keep the "seen in" caption only when showing the in-context close-up.
          ctx.hidden = which !== 'close' || !opts.contextLabel;
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
        (quoteUrlForProduct(p)
          ? '<a class="btn btn-primary detail-quote" href="' + quoteUrlForProduct(p) + '" target="_blank" rel="noopener noreferrer">' +
              WA_ICON_SVG + '<span>' + t('quote.cta') + '</span>' +
            '</a>'
          : '') +
        '<button class="btn btn-ghost" data-action="view-space">' + t('detail.viewInSpace') + '</button>' +
        '<button class="btn btn-ghost" data-action="download-sheet">' + t('detail.downloadSheet') + '</button>' +
        '<button class="btn btn-ghost detail-fav" data-action="fav">' +
          (isFav(p.id) ? t('detail.saved') : t('detail.favorite')) + '</button>' +
      '</div>';

    $('[data-action="view-space"]', $('#detailBody')).addEventListener('click', function () {
      closeDetail();
      var sp = findSpaceFor(p.id);
      if (sp) setActiveSpace(sp.id);
      go('spaces', { preserveSpace: true });
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

  var activeSpaceFilters = { spaces: [], collections: [] };

  function parseSceneTags(scene) {
    // Room-type ("Living", "Dining"…) is parsed from the EN name so the ES
    // translation can read naturally ("Colección Living Aballs") without
    // breaking the room-type chooser or the lateral filters.
    var nameEn = (scene.name && scene.name.en) || (typeof scene.name === 'string' ? scene.name : '') || scene.id || '';
    var s = String(nameEn).trim();
    var withoutSuffix = s.replace(/\s+Collection\s*$/i, '');
    var firstSpace = withoutSuffix.indexOf(' ');
    if (firstSpace === -1) return { space: withoutSuffix, collection: '' };
    return {
      space: withoutSuffix.substring(0, firstSpace).trim(),
      collection: withoutSuffix.substring(firstSpace + 1).trim()
    };
  }

  function spacesByCatalog() {
    var all = DATA.spaces || [];
    if (!activeCatalogFilter) return all;
    return all.filter(function (sp) { return sp._catalog === activeCatalogFilter; });
  }

  function visibleSpaces() {
    return spacesByCatalog().filter(function (sp) {
      var tags = parseSceneTags(sp);
      if (activeSpaceFilters.spaces.length && activeSpaceFilters.spaces.indexOf(tags.space) === -1) return false;
      if (activeSpaceFilters.collections.length && activeSpaceFilters.collections.indexOf(tags.collection) === -1) return false;
      return true;
    });
  }

  function spaceTagsInUse() {
    var spacesSet = {}, collectionsSet = {};
    spacesByCatalog().forEach(function (sp) {
      var tags = parseSceneTags(sp);
      if (tags.space) spacesSet[tags.space] = true;
      if (tags.collection) collectionsSet[tags.collection] = true;
    });
    var spaceOrder = ['Living', 'Dining', 'Kitchen', 'Bedroom', 'Bathroom'];
    var spaceList = spaceOrder.filter(function (s) { return spacesSet[s]; });
    Object.keys(spacesSet).forEach(function (s) { if (spaceList.indexOf(s) === -1) spaceList.push(s); });
    var collectionList = Object.keys(collectionsSet).sort(function (a, b) { return a.localeCompare(b); });
    return { spaces: spaceList, collections: collectionList };
  }

  function toggleSpaceFilter(group, value) {
    var arr = activeSpaceFilters[group];
    var i = arr.indexOf(value);
    if (i === -1) arr.push(value); else arr.splice(i, 1);
  }
  function totalActiveSpaceFilters() {
    return activeSpaceFilters.spaces.length + activeSpaceFilters.collections.length;
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

  function renderSpaceSide() {
    var wrap = $('#spacesSide');
    if (!wrap) return;
    wrap.innerHTML = '';

    var closeBtn = el('button', 'filter-drawer-close', '×');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', t('filters.close'));
    closeBtn.addEventListener('click', function () { closeFiltersDrawer(); });
    wrap.appendChild(closeBtn);

    updateFiltersToggleCount('spacesFiltersCount', totalActiveSpaceFilters());

    var tags = spaceTagsInUse();

    if (totalActiveSpaceFilters() > 0) {
      var clearBtn = el('button', 'filter-clear', t('filters.clear') + ' (' + totalActiveSpaceFilters() + ')');
      clearBtn.type = 'button';
      clearBtn.addEventListener('click', function () {
        activeSpaceFilters = { spaces: [], collections: [] };
        var vs = visibleSpaces();
        if (!vs.some(function (s) { return s.id === activeSpace; })) {
          activeSpace = vs[0] ? vs[0].id : null;
        }
        renderSpaceSide();
        renderActiveSpace();
      });
      wrap.appendChild(clearBtn);
    }

    function renderGroup(titleKey, values, group) {
      if (!values.length) return;
      var fs = el('fieldset', 'filter-group');
      var lg = el('legend', 'filter-group-title', t(titleKey));
      fs.appendChild(lg);
      values.forEach(function (val) {
        var row = el('label', 'filter-check');
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.value = val;
        input.checked = activeSpaceFilters[group].indexOf(val) !== -1;
        input.addEventListener('change', function () {
          toggleSpaceFilter(group, val);
          var vs = visibleSpaces();
          if (!vs.some(function (s) { return s.id === activeSpace; })) {
            activeSpace = vs[0] ? vs[0].id : null;
          }
          renderSpaceSide();
          renderActiveSpace();
        });
        // For the "spaces" group, translate the EN tag (Living/Dining/Bathroom…)
        // into the active language via the roomType.* i18n keys.
        var displayLabel = (group === 'spaces') ? t('roomType.' + val) : val;
        row.appendChild(input);
        row.appendChild(el('span', 'filter-check-label', displayLabel));
        fs.appendChild(row);
      });
      wrap.appendChild(fs);
    }
    renderGroup('filters.spaces', tags.spaces, 'spaces');
    renderGroup('filters.collections', tags.collections, 'collections');

    var matched = visibleSpaces();
    var listTitle = el('h4', 'spaces-list-title', t('spaces.list.title'));
    wrap.appendChild(listTitle);

    if (!matched.length) {
      var empty = el('p', 'spaces-list-empty', t('spaces.list.empty'));
      wrap.appendChild(empty);
      return;
    }

    var list = el('div', 'spaces-list');
    matched.forEach(function (sp) {
      var card = el('button', 'space-list-card');
      card.type = 'button';
      var thumb = sp.image ? '<span class="space-list-thumb"><img src="' + uri(sp.image) + '" alt="" /></span>' : '<span class="space-list-thumb"></span>';
      card.innerHTML = thumb + '<span class="space-list-name">' + tx(sp.name) + '</span>';
      card.addEventListener('click', function () {
        // In magazine view every matched scene is already on screen — just
        // scroll the lateral list click to the matching section.
        var section = document.querySelector('[data-space-id="' + sp.id + '"]');
        if (section) {
          scrollSectionIntoView(section);
          var sSide = $('#spacesSide');
          if (sSide && sSide.classList.contains('is-open')) closeFiltersDrawer();
        } else {
          setActiveSpace(sp.id);
        }
      });
      list.appendChild(card);
    });
    wrap.appendChild(list);
  }

  // Kept name `renderSpaceTabs` for backwards-compat with existing call sites.
  function renderSpaceTabs() { renderSpaceSide(); }

  function setActiveSpace(id) {
    activeSpace = id;
    // Magazine view: if no filter is set yet, derive the room type from the
    // selected scene so the list shows other scenes of the same type instead
    // of the full catalog. The user can still widen via the side filter.
    if (!activeSpaceFilters.spaces.length) {
      var sp = (DATA.spaces || []).filter(function (s) { return s.id === id; })[0];
      if (sp) {
        var tag = parseSceneTags(sp).space;
        if (tag) activeSpaceFilters.spaces = [tag];
      }
    }
    renderSpaceSide();
    renderActiveSpace();
    // Scroll the panels container so the anchor scene starts in view.
    setTimeout(function () {
      var section = document.querySelector('[data-space-id="' + id + '"]');
      if (section) scrollSectionIntoView(section);
    }, 0);
    // Mobile: close the filters drawer if it's open so the chosen scene is visible.
    var sSide = $('#spacesSide');
    if (sSide && sSide.classList.contains('is-open')) closeFiltersDrawer();
  }

  /* Landing dentro de "Espacios": grilla de tipos de ambiente (Living, Comedor,
     Cocina, etc) derivados del primer token del nombre de cada escena. Click
     en un tipo → setea el filtro y abre el primer ambiente de ese tipo. */
  function renderSpaceTypeChooser() {
    var wrap = $('#spaceStageWrap');
    if (!wrap) return;
    wrap.classList.add('is-chooser');
    wrap.innerHTML = '';

    var all = spacesByCatalog();
    var byType = {};
    var typeImage = {};
    all.forEach(function (sp) {
      var tag = parseSceneTags(sp).space;
      if (!tag) return;
      byType[tag] = (byType[tag] || 0) + 1;
      if (!typeImage[tag] && sp.image) typeImage[tag] = sp.image;
    });

    var preferredOrder = ['Living', 'Dining', 'Kitchen', 'Bedroom', 'Bathroom'];
    var types = preferredOrder.filter(function (s) { return byType[s]; });
    Object.keys(byType).forEach(function (s) { if (types.indexOf(s) === -1) types.push(s); });

    if (!types.length) {
      wrap.innerHTML = '<p class="spaces-list-empty">' + t('spaces.list.empty') + '</p>';
      return;
    }

    var header = el('header', 'space-type-header');
    header.innerHTML =
      '<p class="eyebrow">' + t('spacesChooser.eyebrow') + '</p>' +
      '<h2 class="space-type-title">' + t('spacesChooser.title') + '</h2>' +
      '<p class="space-type-sub">' + t('spacesChooser.sub') + '</p>';
    wrap.appendChild(header);

    var grid = el('div', 'space-type-grid');
    types.forEach(function (tag) {
      var label = t('roomType.' + tag);
      var n = byType[tag];
      var countWord = t(n === 1 ? 'spacesChooser.countOne' : 'spacesChooser.countMany');
      var card = el('button', 'space-type-card');
      card.type = 'button';
      card.innerHTML =
        '<div class="space-type-card-media">' +
          (typeImage[tag] ? '<img loading="lazy" src="' + uri(typeImage[tag]) + '" alt="' + label + '" />' : '') +
        '</div>' +
        '<div class="space-type-card-scrim"></div>' +
        '<div class="space-type-card-body">' +
          '<h3 class="space-type-card-title">' + label + '</h3>' +
          '<p class="space-type-card-count">' + n + ' ' + countWord + '</p>' +
        '</div>';
      card.addEventListener('click', function () { pickRoomType(tag); });
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
  }

  function pickRoomType(tag) {
    activeSpaceFilters.spaces = [tag];
    activeSpaceFilters.collections = [];
    var matched = visibleSpaces();
    if (matched.length) {
      setActiveSpace(matched[0].id);
    } else {
      // No scene matches (shouldn't happen since chooser only lists used types).
      renderSpaceSide();
      renderActiveSpace();
    }
  }

  function backToSpaceChooser() {
    activeSpace = null;
    activeSpaceFilters = { spaces: [], collections: [] };
    renderSpaceSide();
    renderActiveSpace();
  }

  /* Scroll the `.panels` container so the given section sits near the top of
     the visible viewport. We avoid Element.scrollIntoView because the parent
     layout has nested overflow boundaries that swallow the request, and we
     temporarily override scroll-behavior so the assignment lands reliably
     even when a CSS smooth-scroll rule is in effect. */
  function scrollSectionIntoView(section) {
    if (!section) return;
    var panels = $('.panels');
    if (!panels) return;
    var topbar = $('.topbar');
    var topbarH = topbar ? topbar.getBoundingClientRect().height : 0;
    var panelsRect = panels.getBoundingClientRect();
    var sectionRect = section.getBoundingClientRect();
    var target = panels.scrollTop + (sectionRect.top - panelsRect.top) - topbarH - 12;
    if (target < 0) target = 0;
    var prev = panels.style.scrollBehavior;
    panels.style.scrollBehavior = 'auto';
    panels.scrollTop = target;
    panels.style.scrollBehavior = prev;
  }

  /* Una "tarjeta" completa de un ambiente: stage con hotspots + sidebar con
     descripción y "Destacados en este ambiente". Es el bloque que se repite
     verticalmente cuando hay varias escenas del tipo elegido. */
  function renderSceneSection(sp) {
    var section = el('article', 'space-section');
    section.dataset.spaceId = sp.id;

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

    section.appendChild(stage);
    section.appendChild(info);

    // Wire interactions scoped to this section. Each scene owns its own
    // hotspots and product-list buttons; the closure captures the right `sp`.
    $$('.hotspot, .space-product', section).forEach(function (node) {
      node.addEventListener('click', function () {
        var pid = node.dataset.id;
        var h = (sp.hotspots || []).filter(function (x) { return x.productId === pid; })[0];
        var opts = (h && h.closeUpImage)
          ? { closeUpImage: h.closeUpImage, contextLabel: tx(sp.name), spaceImage: sp.image }
          : (sp.image ? { spaceImage: sp.image, contextLabel: tx(sp.name) } : null);
        var isHotspot = node.classList.contains('hotspot');
        if (isHotspot && h && h.transitionVideo) {
          // Anchor the cinematic to THIS section's stage (not the first one
          // on the page), so multi-scene layouts play the video in place.
          playHotspotTransition(pid, h, sp, stage);
        } else {
          openDetail(pid, opts);
        }
      });
    });

    return section;
  }

  function renderActiveSpace() {
    var wrap = $('#spaceStageWrap');
    if (!wrap) return;
    // No scene selected → show the room-type chooser landing instead.
    if (!activeSpace) {
      wrap.classList.remove('is-list');
      renderSpaceTypeChooser();
      return;
    }
    var matched = visibleSpaces();
    if (!matched.length) {
      // Filter wiped out everything — fall back to chooser cleanly.
      activeSpace = null;
      wrap.classList.remove('is-list');
      renderSpaceTypeChooser();
      return;
    }
    wrap.classList.remove('is-chooser');
    wrap.classList.add('is-list');
    wrap.innerHTML = '';

    var back = el('button', 'space-back-link');
    back.type = 'button';
    back.innerHTML = '<span class="space-back-arrow" aria-hidden="true">←</span>' +
                     '<span>' + t('spacesChooser.back') + '</span>';
    back.addEventListener('click', backToSpaceChooser);
    wrap.appendChild(back);

    matched.forEach(function (sp) {
      wrap.appendChild(renderSceneSection(sp));
    });
  }

  /* =============================================================================
     HOTSPOT TRANSITION — video plays in-place inside the active .space-stage.
     When it ends (or is skipped) the hotspot's closeUpImage fades in over the
     video, giving a reliable "frozen on the product" final frame, and a small
     info card appears on top.
     ========================================================================== */
  function playHotspotTransition(pid, h, sp, stageEl) {
    var prod = productById(pid);
    if (!prod) return;

    var overlay = $('#transitionOverlay');
    var video   = $('#transitionVideo');
    var still   = $('#transitionStill');
    var card    = $('#transitionCard');
    var skipBtn = $('#transitionSkip');
    var btnDetail = $('#transitionCardDetail');
    var btnClose  = $('#transitionCardClose');
    if (!overlay || !video || !card) return;

    // Anchor the overlay to the stage the user clicked from (each scene has
    // its own .space-stage in magazine view). Fall back to the first one if
    // no explicit stage was passed.
    var stage = stageEl || $('.space-stage');
    if (stage && overlay.parentNode !== stage) stage.appendChild(overlay);

    // Use the current scene image as the overlay's backdrop so the user never
    // sees a black flash while the video is still decoding its first frame.
    if (sp.image) {
      overlay.style.backgroundImage = 'url("' + uri(sp.image) + '")';
    } else {
      overlay.style.backgroundImage = '';
    }

    // Fill the card (kept hidden until the video ends).
    $('#transitionCardEyebrow').textContent = t('category.' + prod.category);
    $('#transitionCardName').textContent    = prod.name;
    $('#transitionCardCode').textContent    = prod.code || '';
    $('#transitionCardDesc').textContent    = tx(prod.description);
    var quoteLink = $('#transitionCardQuote');
    var quoteLbl  = $('#transitionCardQuoteLabel');
    var waUrl = quoteUrlForProduct(prod);
    if (quoteLink) {
      if (waUrl) {
        quoteLink.href = waUrl;
        quoteLink.hidden = false;
      } else {
        quoteLink.removeAttribute('href');
        quoteLink.hidden = true;
      }
    }
    if (quoteLbl) quoteLbl.textContent = t('quote.cta');
    card.hidden = true;
    // Always start collapsed; the user expands on tap.
    card.classList.remove('is-expanded');
    var toggleBtn = $('#transitionCardToggle');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');

    // Clear any stale close-up from a previous transition BEFORE we kick off the
    // new preload — otherwise the old image can flash in for a beat.
    still.hidden = true;
    still.removeAttribute('src');

    // Preload the close-up out-of-band; only assign to the visible <img> once
    // the bitmap is fully decoded so the reveal at the end is instant (no lag,
    // no "previous image" ghost). If preload fails, we still flip on reveal.
    var closeUpReady = !h.closeUpImage;
    if (h.closeUpImage) {
      var preloader = new Image();
      preloader.onload = function () {
        closeUpReady = true;
        still.src = preloader.src;
      };
      preloader.onerror = function () {
        closeUpReady = true;
        still.src = uri(h.closeUpImage);
      };
      preloader.src = uri(h.closeUpImage);
    }

    // Reset video; keep it invisible until first frame is ready (avoids the
    // black flash that some browsers show between src-set and first-decoded-frame).
    video.pause();
    video.removeAttribute('loop');
    video.muted = true;
    video.style.visibility = '';
    video.style.opacity = '0';
    video.src = uri(h.transitionVideo);
    video.currentTime = 0;

    overlay.hidden = false;

    var playStarted = false;
    function startPlayback() {
      if (playStarted) return;
      playStarted = true;
      // Fade the video in over the scene backdrop so the cut is invisible.
      video.style.opacity = '1';
      var p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () { revealCard(); });
      }
    }
    video.addEventListener('loadeddata', startPlayback);
    // Safety net: if the browser never fires loadeddata (rare), kick playback
    // anyway after a short wait so the user isn't stuck staring at a still.
    var startFallback = setTimeout(startPlayback, 1200);

    function finishReveal() {
      if (still.src) {
        still.hidden = false;
        // Hide the video underneath so nothing ghosts through the close-up.
        video.style.visibility = 'hidden';
        // Drop the scene backdrop now that the close-up is on screen. Without
        // this the scene leaks through any transparent edge of the still and
        // shows up as a "ghost image" behind the product close-up.
        overlay.style.backgroundImage = '';
      }
      card.hidden = false;
    }
    function revealCard() {
      try { video.pause(); } catch (e) {}
      if (closeUpReady) { finishReveal(); return; }
      // Close-up still loading — wait briefly so we don't reveal a blank frame.
      var poll = setInterval(function () {
        if (closeUpReady) { clearInterval(poll); finishReveal(); }
      }, 50);
      setTimeout(function () { clearInterval(poll); finishReveal(); }, 1500);
    }

    function cleanup() {
      clearTimeout(startFallback);
      video.removeEventListener('loadeddata', startPlayback);
      video.removeEventListener('ended', revealCard);
      skipBtn.removeEventListener('click', revealCard);
      btnDetail.removeEventListener('click', onDetail);
      btnClose.removeEventListener('click', closeOverlay);
      document.removeEventListener('keydown', onKey);
    }
    function closeOverlay() {
      cleanup();
      try { video.pause(); } catch (e) {}
      video.removeAttribute('src');
      video.load();
      video.style.visibility = '';
      video.style.opacity = '';
      still.hidden = true;
      still.removeAttribute('src');
      overlay.hidden = true;
      overlay.style.backgroundImage = '';
      card.hidden = true;
      if (overlay.parentNode !== document.body) document.body.appendChild(overlay);
    }
    function onDetail() {
      var opts = h.closeUpImage
        ? { closeUpImage: h.closeUpImage, contextLabel: tx(sp.name), spaceImage: sp.image }
        : (sp.image ? { spaceImage: sp.image, contextLabel: tx(sp.name) } : null);
      closeOverlay();
      openDetail(pid, opts);
    }
    function onKey(e) {
      if (e.key === 'Escape') closeOverlay();
    }

    video.addEventListener('ended', revealCard);
    skipBtn.addEventListener('click', revealCard);
    btnDetail.addEventListener('click', onDetail);
    btnClose.addEventListener('click', closeOverlay);
    document.addEventListener('keydown', onKey);
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

  function updateFiltersToggleCount(countId, n) {
    var span = $('#' + countId);
    if (!span) return;
    if (n > 0) { span.textContent = n; span.hidden = false; }
    else { span.hidden = true; }
  }
  function openFiltersDrawer(sideEl, toggleEl) {
    if (!sideEl) return;
    sideEl.classList.add('is-open');
    var bd = $('#filtersBackdrop');
    if (bd) { bd.hidden = false; setTimeout(function () { bd.classList.add('is-active'); }, 0); }
    if (toggleEl) toggleEl.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeFiltersDrawer() {
    var sides = document.querySelectorAll('.filters-side, .spaces-side');
    sides.forEach(function (s) { s.classList.remove('is-open'); });
    var bd = $('#filtersBackdrop');
    if (bd) {
      bd.classList.remove('is-active');
      setTimeout(function () { bd.hidden = true; }, 250);
    }
    var toggles = document.querySelectorAll('.filters-toggle');
    toggles.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    document.body.style.overflow = '';
  }
  /* Same toggle button used on desktop and mobile, with different semantics:
       desktop → collapse/uncollapse the side column of the layout
       mobile  → open/close the slide-in drawer
     A single media query check picks the branch at click time. */
  function isMobileViewport() {
    return window.matchMedia('(max-width: 900px)').matches;
  }
  function toggleFiltersPane(sideSel, layoutSel, toggleEl) {
    if (isMobileViewport()) {
      var side = $(sideSel);
      if (side && side.classList.contains('is-open')) closeFiltersDrawer();
      else openFiltersDrawer(side, toggleEl);
      return;
    }
    var layout = $(layoutSel);
    if (!layout) return;
    var nowCollapsed = layout.classList.toggle('filters-collapsed');
    if (toggleEl) toggleEl.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
  }

  function bindFilterDrawers() {
    // Default state on desktop: sidebar hidden, main fills the row. The user
    // opens it explicitly with the "Filtros" button. (On mobile this class
    // has no effect — the drawer behaviour is independent.)
    var pLayout = $('.products-layout');
    if (pLayout) pLayout.classList.add('filters-collapsed');
    var sLayout = $('.spaces-layout');
    if (sLayout) sLayout.classList.add('filters-collapsed');

    var pToggle = $('#productsFiltersToggle');
    if (pToggle) {
      pToggle.setAttribute('aria-expanded', 'false');
      pToggle.addEventListener('click', function () {
        toggleFiltersPane('#filtersSide', '.products-layout', pToggle);
      });
    }
    var sToggle = $('#spacesFiltersToggle');
    if (sToggle) {
      sToggle.setAttribute('aria-expanded', 'false');
      sToggle.addEventListener('click', function () {
        toggleFiltersPane('#spacesSide', '.spaces-layout', sToggle);
      });
    }
    var bd = $('#filtersBackdrop');
    if (bd) bd.addEventListener('click', closeFiltersDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeFiltersDrawer();
    });
  }

  function bindTransitionCard() {
    var toggle = $('#transitionCardToggle');
    var card = $('#transitionCard');
    if (!toggle || !card) return;
    toggle.addEventListener('click', function () {
      var nowExpanded = !card.classList.contains('is-expanded');
      card.classList.toggle('is-expanded');
      toggle.setAttribute('aria-expanded', nowExpanded ? 'true' : 'false');
    });
  }

  function init() {
    activeSpace = (DATA.spaces && DATA.spaces[0] && DATA.spaces[0].id) || null;

    applyStaticI18n();
    updateLangToggle();
    renderAll();
    bindGlobalNav();
    bindFilterDrawers();
    bindTransitionCard();

    var start = (window.location.hash || '').replace('#', '');
    go(ROUTES[start] ? start : 'home');
  }

  /* =============================================================================
     Refresh hook — called by catalog.data.js after dynamic data merges
     ========================================================================== */
  window.LUXA_App = {
    refreshSpaces: function () {
      // Spaces panel now lands on a room-type chooser; the first scene is
      // only activated when the user picks a type, so don't auto-select here.
      renderCatalogFilter();
      renderSpaceTabs();
      renderActiveSpace();
      // Home cards también dependen de DATA.spaces (cargado async)
      renderHomeSpaces();
      // Bridge necesita findSpaceFor() para el caption "En contexto"
      renderHomeBridge();
    },
    refreshProducts: function () {
      renderFilters();
      renderProducts();
      updateProductCount();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
