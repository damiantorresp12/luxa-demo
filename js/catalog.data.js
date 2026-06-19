/* =============================================================================
   LUXA · TD Lighting Experience — Catálogo bilingüe (ES default, EN)
   -----------------------------------------------------------------------------
   · Diccionario i18n en `i18n`. Strings con clave plana (dot notation).
   · Campos de contenido bilingüe usan objetos { es, en }. app.js los resuelve
     con tx(). Faltantes caen a EN.
   · Nombres comerciales, códigos, designer, potencias/lúmenes/etc. quedan
     en inglés (universales).
   ========================================================================== */
(function () {
  'use strict';

  var IMG = 'assets/Imagenes/';
  var MOD = 'assets/models/';

  function asset(base, opts) {
    opts = opts || {};
    return {
      image: IMG + base + '.jpg',
      model: MOD + base + '.max',
      gallery: opts.gallery || [],
      pdfs:    opts.pdfs    || [],
      glb: null, fbx: null, ies: null, dwg: null, bim: null
    };
  }

  window.LUXA = {

    /* ----------------------------------------------------------------------- */
    /* I18N — UI dictionary. Default ES, fallback EN.                          */
    i18n: {
      es: {
        // Nav
        'nav.home':       'Inicio',
        'nav.products':   'Productos',
        'nav.spaces':     'Ambientes',
        'nav.downloads':  'Descargas',
        'nav.favorites':  'Favoritos',
        'nav.about':      'Acerca',

        // Topbar (eyebrow + title) por ruta
        'topbar.home.eyebrow':      'Bienvenido',
        'topbar.home.title':        'Inicio',
        'topbar.products.eyebrow':  'Colección',
        'topbar.products.title':    'Productos',
        'topbar.spaces.eyebrow':    'En contexto',
        'topbar.spaces.title':      'Ambientes',
        'topbar.downloads.eyebrow': 'Recursos',
        'topbar.downloads.title':   'Descargas',
        'topbar.favorites.eyebrow': 'Tu selección',
        'topbar.favorites.title':   'Favoritos',
        'topbar.about.eyebrow':     'La marca',
        'topbar.about.title':       'Sobre LUXA',

        // Home
        'home.tag':        'Experiencias de iluminación<br/>para espacios modernos',
        'home.sub':        'Explorá productos, ambientes y recursos técnicos en un catálogo interactivo.',
        'home.cta':        'Ingresar al catálogo',
        'home.scroll':     'Deslizá para ver más',

        // Shortcuts
        'shortcut.products': 'Productos',
        'shortcut.spaces':   'Ambientes',
        'shortcut.favorites':'Guardados',
        'shortcut.downloads':'Recursos',
        'shortcut.meta.fixtures': '{n} luminarias',
        'shortcut.meta.rooms':    '{n} ambientes',
        'shortcut.meta.saved':    '{n} guardados',
        'shortcut.meta.files':    '{n} archivos',
        'shortcut.meta.noneYet':  'Sin guardados',

        'featured.label':  'Producto destacado',
        'featured.viewDetails': 'Ver detalle',

        // Home — Explore by Space + Quick links
        'homeSpaces.eyebrow':  'Explorar por ambiente',
        'homeSpaces.title':    'Ambientes en contexto',
        'homeSpaces.viewAll':  'Ver todos los ambientes →',
        'homeSpaces.cta':      'Explorar ambiente',
        'homeQuick.products':  'Ver catálogo completo',
        'homeQuick.favorites': 'Mis guardados',

        // Home — Bridge: catálogo ↔ contexto
        'homeBridge.eyebrow':       'Del catálogo al ambiente',
        'homeBridge.title':         'El mismo producto, dos miradas',
        'homeBridge.sub':           'Mirá la pieza aislada como en una ficha técnica — y en su lugar real, ya iluminando.',
        'homeBridge.catalogLabel':  'Catálogo',
        'homeBridge.contextLabel':  'En contexto',
        'homeBridge.cta':           'Ver todos los productos →',

        // Home — CTA cierre comercial (WhatsApp)
        'homeCta.eyebrow':     'Hablemos',
        'homeCta.title':       'Tu próxima reunión comercial sin PDF',
        'homeCta.sub':         'Mostrale a tu cliente un catálogo vivo, con productos aplicados en ambientes reales. Una URL que reemplaza al PDF en showroom, reuniones y WhatsApp.',
        'homeCta.whatsapp':    'Hablemos por WhatsApp',
        'homeCta.whatsappMsg': 'Hola, vi la demo de LUXA y me gustaría conversar sobre el proyecto.',
        'quote.cta':           'Consultar precio',
        'quote.ctaShort':      'Precio',
        'quote.msg':           'Hola, quiero consultar el precio del producto {name} ({code}).',
        'quote.msgNoCode':     'Hola, quiero consultar el precio del producto {name}.',
        'homeCta.spaces':      'Ver ambientes',

        // Pills / topbar actions
        'pill.results.singular': '{n} resultado',
        'pill.results.plural':   '{n} resultados',
        'pill.files':            '{n} archivos',
        'pill.saved':            '{n} guardados',
        'action.clearAll':       'Limpiar todo',

        // Products
        'products.search.placeholder': 'Buscar luminarias…',
        'products.count.singular':     '{n} producto',
        'products.count.plural':       '{n} productos',
        'products.empty.title':        'Sin coincidencias',
        'products.empty.sub':          'Probá otra categoría o limpiá la búsqueda.',
        'products.viewDetails':        'Ver detalle',
        'card.specsSep':               ' · ',

        // Categories (filtro)
        'category.All':            'Todo',
        'category.Pendants':       'Colgantes',
        'category.Chandeliers':    'Arañas',
        'category.Floor Lamps':    'De Pie',
        'category.Table Lamps':    'De Mesa',
        'category.Wall Lights':    'Apliques',
        'category.Ceiling Lights': 'Plafones',
        'category.Downlights':     'Empotrados',

        // Filter sidebar (filtro lateral)
        'filters.categories':  'Categorías',
        'filters.spaces':      'Espacios',
        'filters.collections': 'Colecciones',
        'filters.clear':       'Limpiar filtros',
        'filters.toggle':      'Filtros',
        'filters.close':       'Cerrar filtros',
        'space.living':        'Living',
        'space.dining':        'Comedor',
        'space.bedroom':       'Dormitorio',
        'space.bathroom':      'Baño',
        'space.kitchen':       'Cocina',

        // Detail panel
        'detail.code':         'Código',
        'detail.category':     'Categoría',
        'detail.power':        'Potencia',
        'detail.output':       'Lúmenes',
        'detail.temp':         'Temp. de color',
        'detail.cri':          'CRI',
        'detail.ip':           'Grado IP',
        'detail.dimensions':   'Dimensiones',
        'detail.finish':       'Acabado',
        'detail.application':  'Aplicación',
        'detail.viewInSpace':  'Ver en ambiente',
        'detail.downloadSheet':'Descargar ficha',
        'detail.favorite':     '♡ Favorito',
        'detail.seenIn':       'Visto en',
        'detail.viewClose':    'En contexto',
        'detail.viewCatalog':  'Catálogo',
        'detail.viewAmbient':  'Ambiente',
        'detail.saved':        '♥ Guardado',

        // Spaces panel
        'space.label':       'En contexto',
        'space.featuredIn':  'Destacados en este ambiente',
        'spaces.filter.all': 'Todos',
        'spaces.list.title': 'Ambientes',
        'spaces.list.empty': 'No hay ambientes que coincidan con esos filtros.',
        'roomType.Living':       'Living',
        'roomType.Dining':       'Comedor',
        'roomType.Kitchen':      'Cocina',
        'roomType.Bedroom':      'Dormitorio',
        'roomType.Bathroom':     'Baño',
        'spacesChooser.eyebrow': 'Explorar',
        'spacesChooser.title':   'Elegí un tipo de ambiente',
        'spacesChooser.sub':     'Seleccioná el espacio donde querés ver las luminarias aplicadas.',
        'spacesChooser.countOne':  'ambiente',
        'spacesChooser.countMany': 'ambientes',
        'spacesChooser.back':    'Volver a tipos de ambiente',

        // Downloads
        'downloads.download':       'Descargar PDF',
        'dl.kind.Catalog':          'Catálogo',
        'dl.kind.Technical':        'Técnica',
        'dl.kind.Collection':       'Colección',
        'dl.kind.Guide':            'Guía',

        // Favorites empty state
        'favorites.empty.title': 'Tu colección está vacía',
        'favorites.empty.sub':   'Guardá luminarias tocando el corazón en cualquier card.',
        'favorites.browse':      'Ver productos'
      },

      en: {
        'nav.home':       'Home',
        'nav.products':   'Products',
        'nav.spaces':     'Spaces',
        'nav.downloads':  'Downloads',
        'nav.favorites':  'Favorites',
        'nav.about':      'About',

        'topbar.home.eyebrow':      'Welcome',
        'topbar.home.title':        'Home',
        'topbar.products.eyebrow':  'Collection',
        'topbar.products.title':    'Products',
        'topbar.spaces.eyebrow':    'In Context',
        'topbar.spaces.title':      'Spaces',
        'topbar.downloads.eyebrow': 'Resources',
        'topbar.downloads.title':   'Downloads',
        'topbar.favorites.eyebrow': 'Your saved',
        'topbar.favorites.title':   'Favorites',
        'topbar.about.eyebrow':     'The brand',
        'topbar.about.title':       'About LUXA',

        'home.tag':        'Lighting Experiences<br/>for Modern Spaces',
        'home.sub':        'Explore products, spaces and technical resources in one interactive catalog.',
        'home.cta':        'Enter the catalog',
        'home.scroll':     'Scroll for more',

        'shortcut.products':       'Browse Products',
        'shortcut.spaces':         'Explore Spaces',
        'shortcut.favorites':      'Saved Items',
        'shortcut.downloads':      'Resources',
        'shortcut.meta.fixtures':  '{n} fixtures',
        'shortcut.meta.rooms':     '{n} rooms',
        'shortcut.meta.saved':     '{n} saved',
        'shortcut.meta.files':     '{n} files',
        'shortcut.meta.noneYet':   'None yet',

        'featured.label':       'Featured fixture',
        'featured.viewDetails': 'View details',

        // Home — Explore by Space + Quick links
        'homeSpaces.eyebrow':  'Explore by space',
        'homeSpaces.title':    'Spaces in context',
        'homeSpaces.viewAll':  'View all spaces →',
        'homeSpaces.cta':      'Explore space',
        'homeQuick.products':  'Browse full catalog',
        'homeQuick.favorites': 'My saved items',

        // Home — Bridge: catalog ↔ context
        'homeBridge.eyebrow':       'From catalog to context',
        'homeBridge.title':         'The same product, two takes',
        'homeBridge.sub':           'See the piece in isolation, like a spec sheet — and alive in its place, already lighting.',
        'homeBridge.catalogLabel':  'Catalog',
        'homeBridge.contextLabel':  'In context',
        'homeBridge.cta':           'View all products →',

        // Home — Closing CTA (WhatsApp)
        'homeCta.eyebrow':     'Let’s talk',
        'homeCta.title':       'Your next sales meeting without the PDF',
        'homeCta.sub':         'Show your client a living catalog with products applied in real spaces. A URL that replaces the PDF in showrooms, meetings and WhatsApp.',
        'homeCta.whatsapp':    'Chat on WhatsApp',
        'homeCta.whatsappMsg': 'Hi, I saw the LUXA demo and would like to talk about the project.',
        'quote.cta':           'Ask for price',
        'quote.ctaShort':      'Price',
        'quote.msg':           'Hi, I would like to ask the price of {name} ({code}).',
        'quote.msgNoCode':     'Hi, I would like to ask the price of {name}.',
        'homeCta.spaces':      'See spaces',

        'pill.results.singular': '{n} result',
        'pill.results.plural':   '{n} results',
        'pill.files':            '{n} files',
        'pill.saved':            '{n} saved',
        'action.clearAll':       'Clear all',

        'products.search.placeholder': 'Search fixtures…',
        'products.count.singular':     '{n} product',
        'products.count.plural':       '{n} products',
        'products.empty.title':        'No fixtures match',
        'products.empty.sub':          'Try a different category or clear your search.',
        'products.viewDetails':        'View Details',
        'card.specsSep':               ' · ',

        'category.All':            'All',
        'category.Pendants':       'Pendants',
        'category.Chandeliers':    'Chandeliers',
        'category.Floor Lamps':    'Floor Lamps',
        'category.Table Lamps':    'Table Lamps',
        'category.Wall Lights':    'Wall Lights',
        'category.Ceiling Lights': 'Ceiling Lights',
        'category.Downlights':     'Downlights',

        'detail.code':         'Code',
        'detail.category':     'Category',
        'detail.power':        'Power',
        'detail.output':       'Output',
        'detail.temp':         'Color temp.',
        'detail.cri':          'CRI',
        'detail.ip':           'IP rating',
        'detail.dimensions':   'Dimensions',
        'detail.finish':       'Finish',
        'detail.application':  'Application',
        'detail.viewInSpace':  'View in Space',
        'detail.downloadSheet':'Download Sheet',
        'detail.favorite':     '♡ Favorite',
        'detail.seenIn':       'Seen in',
        'detail.viewClose':    'In context',
        'detail.viewCatalog':  'Catalog',
        'detail.viewAmbient':  'Space',
        'detail.saved':        '♥ Saved',

        'space.label':       'In context',
        'space.featuredIn':  'Featured in this space',
        'spaces.filter.all': 'All',
        'spaces.list.title': 'Spaces',
        'spaces.list.empty': 'No spaces match those filters.',
        'roomType.Living':       'Living',
        'roomType.Dining':       'Dining',
        'roomType.Kitchen':      'Kitchen',
        'roomType.Bedroom':      'Bedroom',
        'roomType.Bathroom':     'Bathroom',
        'spacesChooser.eyebrow': 'Explore',
        'spacesChooser.title':   'Pick a room type',
        'spacesChooser.sub':     'Select the space where you want to see the luminaires applied.',
        'spacesChooser.countOne':  'space',
        'spacesChooser.countMany': 'spaces',
        'spacesChooser.back':    'Back to room types',

        // Filter sidebar
        'filters.categories':  'Categories',
        'filters.spaces':      'Spaces',
        'filters.collections': 'Collections',
        'filters.clear':       'Clear filters',
        'filters.toggle':      'Filters',
        'filters.close':       'Close filters',
        'space.living':        'Living room',
        'space.dining':        'Dining room',
        'space.bedroom':       'Bedroom',
        'space.bathroom':      'Bathroom',
        'space.kitchen':       'Kitchen',

        'downloads.download':       'Download PDF',
        'dl.kind.Catalog':          'Catalog',
        'dl.kind.Technical':        'Technical',
        'dl.kind.Collection':       'Collection',
        'dl.kind.Guide':            'Guide',

        'favorites.empty.title': 'Your collection is empty',
        'favorites.empty.sub':   'Save products you love by tapping the heart on any card.',
        'favorites.browse':      'Browse products'
      }
    },

    /* ----------------------------------------------------------------------- */
    brand: {
      name: 'LUXA',
      by: 'TD Lighting Experience',
      accent: '#C9A24B',
      contact: {
        /* WhatsApp en formato internacional sin '+' ni espacios.
           Origen: +54 9 11 6002-9154 (Argentina · móvil) */
        whatsapp: '5491160029154'
      }
    },

    /* Bridge editorial Home: producto destacado mostrado dos veces — catálogo + contexto.
       Cambia productId/closeUpImage para rotar la pieza del bridge sin tocar código. */
    homeBridge: {
      productId: 'aballs-m-table',
      closeUpImage: 'assets/Spaces/Living 01/Living 01 close up 01.jpeg'
    },

    categories: [
      'Pendants', 'Chandeliers', 'Floor Lamps', 'Table Lamps',
      'Wall Lights', 'Ceiling Lights', 'Downlights'
    ],

    homeHeroImage: 'assets/Spaces/Living 01/Living 01.jpeg',
    // Slideshow del hero del home. Pueden ser 1, 2, 3 o más imágenes — la app
    // las roto automáticamente con fade. Para cambiar, editar este array.
    homeHeroImages: [
      'assets/Spaces/Living 01/Living 01.jpeg',
      'assets/Spaces/bedroom 01/bedroom 01.jpeg',
      'assets/Spaces/Kitchen 01/Kitchen 01.jpeg'
    ],

    /* ----------------------------------------------------------------------- */
    /* PRODUCTS — names/codes/designer/specs en inglés (universales).
       description y application son {es, en}. finish queda en inglés.        */
    products: [
      // ---------- PENDANTS -------------------------------------------------
      {
        id: 'tempo-pendant', code: 'DVA-5776', name: 'Tempo Pendant', category: 'Pendants',
        designer: 'LUXA Studio', power: '18 W', lumens: '1280 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 320 × H 280 mm', finish: 'Spun aluminium · Matte black',
        application: { es: 'Mesas de comedor e islas de cocina', en: 'Dining tables and kitchen islands' },
        description: {
          es: 'Un colgante de precisión silenciosa. La pantalla hilada pliega la luz en un haz suave, ideal sobre una mesa donde la calidez importa más que el alcance.',
          en: 'A quietly precise pendant. The spun shade folds light into a soft pool, ideal over a table where warmth matters more than throw.'
        },
        featured: true,
        assets: asset('DVA-5776 Tempo Pendant Lamp_corona')
      },
      {
        id: 'aim-led-pendant', code: 'DVA-AIM', name: 'Aim LED Pendant', category: 'Pendants',
        designer: 'LUXA Studio', power: '24 W', lumens: '1750 lm', temperature: '3000 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 240 × H 320 mm', finish: 'Aluminium · Polished',
        application: { es: 'Mesadas, mesas auxiliares, rincones de lectura', en: 'Counters, side tables, reading corners' },
        description: {
          es: 'La alimentación flexible permite orientar el cabezal exactamente donde la luz hace falta. Arquitectura y gesto en una sola luminaria.',
          en: 'The flexible feed lets the head be aimed exactly where light is needed. Architecture and gesture in a single fixture.'
        },
        featured: true,
        assets: asset('DVA-Aim LED Pendant Lamp_vray')
      },
      {
        id: 'bolle-orizzontale', code: 'DVA-BOL', name: 'Bolle Orizzontale', category: 'Pendants',
        designer: 'LUXA Studio', power: '36 W', lumens: '2400 lm', temperature: '2700 K',
        cri: '≥ 95', ip: 'IP20', dimensions: 'L 900 × H 450 mm', finish: 'Hand-blown glass · Brushed brass',
        application: { es: 'Cajas de escalera y dobles alturas', en: 'Stairwells and double-height voids' },
        description: {
          es: 'Esferas sopladas a mano suspendidas en aparente ingravidez. Un racimo escultórico que se lee como luz hecha materia.',
          en: 'Hand-blown spheres suspended in apparent weightlessness. A sculptural cluster that reads as light made tangible.'
        },
        featured: true,
        assets: asset('DVA-Bolle Orizzontale Hanging Lamp_corona')
      },
      {
        id: 'aplomb-suspension', code: 'DVA-APL', name: 'Aplomb Suspension', category: 'Pendants',
        designer: 'LUXA Studio', power: '20 W', lumens: '1500 lm', temperature: '3000 K',
        cri: '≥ 90', ip: 'IP65', dimensions: 'Ø 180 × H 230 mm', finish: 'Cast concrete · Natural grey',
        application: { es: 'Bares, baños e interiores aptos para exterior', en: 'Bars, bathrooms and outdoor-rated interiors' },
        description: {
          es: 'Fundida en hormigón, cruda y a la vez refinada. El cuerpo mate absorbe el deslumbramiento y ancla la luz con honestidad material.',
          en: 'Cast in concrete, raw yet refined. The matte body absorbs glare and grounds the light with material honesty.'
        },
        featured: false,
        assets: asset('DVA-Aplomb Suspension Light_corona')
      },
      {
        id: 'arena-suspension', code: 'DVA-ARN', name: 'Arena Suspension 150', category: 'Pendants',
        designer: 'LUXA Studio', power: '48 W', lumens: '3600 lm', temperature: '3000 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 1500 × H 60 mm', finish: 'Anodised aluminium ring',
        application: { es: 'Mesas de reunión y lobbies', en: 'Conference tables and lobbies' },
        description: {
          es: 'Un anillo luminoso fino que flota sobre el ambiente. La luz ascendente roza el techo mientras un baño descendente define la superficie debajo.',
          en: 'A thin luminous ring that floats above the room. Uplight grazes the ceiling while a soft downward wash defines the surface below.'
        },
        featured: false,
        assets: asset('DVA-Arena Suspension Lamp 150_corona')
      },
      {
        id: 'awa-suspended', code: 'DVA-AWA', name: 'Awa Suspended', category: 'Pendants',
        designer: 'LUXA Studio', power: '15 W', lumens: '1100 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 380 × H 300 mm', finish: 'Opal glass · Satin nickel',
        application: { es: 'Dormitorios y comedores íntimos', en: 'Bedrooms and intimate dining' },
        description: {
          es: 'Una cúpula opal generosa difunde la luz por igual en todas las direcciones — sin puntos calientes, sin deslumbre, solo una presencia cálida.',
          en: 'A generous opal dome diffuses light evenly in every direction — no hotspots, no glare, only a warm presence.'
        },
        featured: false,
        assets: asset('DVA-Awa Large Suspended Light_corona')
      },
      {
        id: 'lighto-t-suspension', code: 'DVA-LTS', name: 'Lighto T Suspension', category: 'Pendants',
        designer: 'LUXA Studio', power: '10 W', lumens: '720 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 250 × cable 1500 mm', finish: 'Opal sphere · Brushed brass cap',
        application: { es: 'Mesas y zonas de estar', en: 'Tables and seating areas' },
        description: {
          es: 'Un globo opal suspendido de un cabezal de latón — la versión colgante del lenguaje Lighto: limpia, atemporal y suave.',
          en: 'An opal globe suspended from a brushed brass cap — the hanging form of the Lighto language: clean, timeless and soft.'
        },
        featured: false,
        assets: asset('DVA-Lighto T Suspension Lamp_corona')
      },

      // ---------- CHANDELIERS ----------------------------------------------
      {
        id: 'aballs-chandelier-8', code: 'DVA-AB8', name: 'Aballs Chandelier 8', category: 'Chandeliers',
        designer: 'LUXA Studio', power: '8 × 6 W', lumens: '4000 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 900 × H 700 mm', finish: 'Opal spheres · Matte black frame',
        application: { es: 'Comedores y hospitality', en: 'Dining rooms and hospitality' },
        description: {
          es: 'Ocho globos opal orbitan una armadura negra y esbelta — una araña contemporánea que cambia el cristal por luz pura y difusa.',
          en: 'Eight opal globes orbit a slender black armature — a contemporary chandelier that swaps crystal for pure, diffuse light.'
        },
        featured: true,
        assets: asset('DVA-Aballs Chandelier 8_corona')
      },
      {
        id: 'aballs-chandelier-12', code: 'DVA-AB12', name: 'Aballs Chandelier 12', category: 'Chandeliers',
        designer: 'LUXA Studio', power: '12 × 6 W', lumens: '6000 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 1200 × H 850 mm', finish: 'Opal spheres · Matte black frame',
        application: { es: 'Lobbies e interiores de gran escala', en: 'Lobbies and grand interiors' },
        description: {
          es: 'La hermana mayor de la familia. Doce globos llenan un volumen con luz suave y pareja, a la altura de una doble altura.',
          en: 'The larger sibling of the family. Twelve globes fill a volume with soft, even light worthy of a double-height room.'
        },
        featured: false,
        assets: asset('DVA-Aballs Chandelier 12_corona')
      },
      {
        id: 'aballs-chandelier-4', code: 'DVA-AB4', name: 'Aballs Chandelier 4', category: 'Chandeliers',
        designer: 'LUXA Studio', power: '4 × 6 W', lumens: '2000 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 600 × H 500 mm', finish: 'Opal spheres · Brushed brass frame',
        application: { es: 'Recibidores y comedores compactos', en: 'Entries and compact dining' },
        description: {
          es: 'Un cuarteto de esferas encendidas — la pieza más discreta de la familia Aballs, a escala de ambientes más pequeños.',
          en: 'A quartet of glowing spheres — the most discreet member of the Aballs family, scaled for smaller rooms.'
        },
        featured: false,
        assets: asset('DVA-Aballs Chandelier 4_corona')
      },

      // ---------- FLOOR LAMPS ----------------------------------------------
      {
        id: 'arco-floor', code: 'DVA-ARC', name: 'Arco Floor', category: 'Floor Lamps',
        designer: 'LUXA Studio', power: '22 W', lumens: '1600 lm', temperature: '3000 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Reach 2100 × H 2400 mm', finish: 'Marble base · Polished steel arc',
        application: { es: 'Sobre sofás y zonas de estar', en: 'Over sofas and lounge seating' },
        description: {
          es: 'El arco que llevó la luz cenital adonde ninguna pieza de techo podía llegar. Un contrapeso de mármol ancla una curva de acero envolvente.',
          en: 'The arc that put overhead light where no ceiling fitting could reach. A marble counterweight anchors a sweeping steel curve.'
        },
        featured: true,
        assets: asset('DVA-Arco Floor Lamp_corona')
      },
      {
        id: 'apollo-floor', code: 'DVA-APO', name: 'Apollo Floor', category: 'Floor Lamps',
        designer: 'LUXA Studio', power: '14 W', lumens: '1000 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 250 × H 1750 mm', finish: 'Matte white · Bronze detail',
        application: { es: 'Rincones de lectura y mesas de luz', en: 'Reading corners and bedsides' },
        description: {
          es: 'Una semiesfera pivota para bañar una pared o concentrarse en una página. Silenciosa, arquitectónica, infinitamente ajustable.',
          en: 'A half-dome head pivots to wash a wall or focus on a page. Quiet, architectural, endlessly adjustable.'
        },
        featured: false,
        assets: asset('DVA-Apollo Floor Lamp_corona')
      },
      {
        id: 'ayno-floor', code: 'DVA-AYN', name: 'Ayno Floor', category: 'Floor Lamps',
        designer: 'LUXA Studio', power: '11 W', lumens: '820 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Base 300 × H 1900 mm', finish: 'Powder-coated steel · Leather strap',
        application: { es: 'Estudios y rincones de lectura', en: 'Home offices and reading nooks' },
        description: {
          es: 'Un cable tensado y una correa de cuero convierten el vástago en una luz de tarea precisa. Lógica industrial, calidez doméstica.',
          en: 'A tensioned cord and leather strap turn the stem into a precise task light. Industrial logic, domestic warmth.'
        },
        featured: false,
        assets: asset('DVA-Ayno Large Floor Lamp_corona')
      },
      {
        id: 'flat-floor', code: 'DVA-5945', name: 'Flat Floor', category: 'Floor Lamps',
        designer: 'LUXA Studio', power: '19 W', lumens: '1400 lm', temperature: '3000 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 200 × H 1800 mm', finish: 'Slim aluminium · Matte black',
        application: { es: 'Salas contemporáneas', en: 'Contemporary living spaces' },
        description: {
          es: 'Un disco de luz sobre un vástago casi invisible. Huella mínima, calma máxima — luz reducida a su geometría esencial.',
          en: 'A disc of light on a near-invisible stem. Minimal footprint, maximal calm — light reduced to its essential geometry.'
        },
        featured: false,
        assets: asset('DVA-5945 Flat Floor Lamp_corona')
      },
      {
        id: 'lightolight-p-floor', code: 'DVA-LTF', name: 'Lightolight P Floor', category: 'Floor Lamps',
        designer: 'LUXA Studio', power: '12 W', lumens: '900 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 300 × H 1700 mm', finish: 'Opal sphere · Brushed brass stem',
        application: { es: 'Rincones de lectura y livings', en: 'Reading nooks and living rooms' },
        description: {
          es: 'Un pie alto rematado por un globo opal — la familia Lighto llevada al piso, marcando un punto de luz suave junto al sofá.',
          en: 'A tall stem topped with an opal globe — the Lighto family taken to the floor, planting a soft pool of light next to the sofa.'
        },
        featured: false,
        assets: asset('DVA-Lightolight P Floor Lamp_corona')
      },

      // ---------- TABLE LAMPS ----------------------------------------------
      {
        id: 'atollo-table', code: 'DVA-ATO', name: 'Atollo Table', category: 'Table Lamps',
        designer: 'LUXA Studio', power: '9 W', lumens: '650 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 380 × H 500 mm', finish: 'Lacquered metal · Matte white',
        application: { es: 'Consolas, aparadores y escritorios', en: 'Consoles, sideboards and desks' },
        description: {
          es: 'Cono, cilindro y semiesfera — una lámpara destilada a geometría pura. Un ícono que es escultura de día y luz de noche.',
          en: 'Cone, cylinder and hemisphere — a lamp distilled to pure geometry. An icon that behaves like sculpture by day and light by night.'
        },
        featured: true,
        assets: asset('DVA-Atollo Table Lamp_corona')
      },
      {
        id: 'arum-table', code: 'DVA-ART', name: 'Arum Table', category: 'Table Lamps',
        designer: 'LUXA Studio', power: '7 W', lumens: '500 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 300 × H 420 mm', finish: 'Pleated metal · Brass',
        application: { es: 'Mesas de luz y superficies de acento', en: 'Bedsides and accent surfaces' },
        description: {
          es: 'Una pantalla plisada se abre como una flor, derramando un resplandor cálido y escultórico sobre la superficie que la sostiene.',
          en: 'A pleated shade unfolds like a flower, throwing a warm, sculpted glow across the surface it sits on.'
        },
        featured: false,
        assets: asset('DVA-Arum Table Lamp_corona')
      },
      {
        id: 'aballs-m-table', code: 'DVA-ABM', name: 'Aballs M Table', category: 'Table Lamps',
        designer: 'LUXA Studio', power: '8 W', lumens: '600 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 250 × H 450 mm', finish: 'Opal sphere · Matte black stem',
        application: { es: 'Dormitorios y livings', en: 'Bedrooms and lounges' },
        description: {
          es: 'Un único globo opal sostenido por un brazo fino. La pieza de escritorio de la familia Aballs — suave, redonda y tranquilizadora.',
          en: 'A single opal globe held by a slim arm. The desk-scale member of the Aballs family — soft, round and reassuring.'
        },
        featured: false,
        assets: asset('DVA-Aballs M Table Lamp_corona')
      },
      {
        id: 'albus-twisted-table', code: 'DVA-ALB', name: 'Albus Twisted Table', category: 'Table Lamps',
        designer: 'LUXA Studio', power: '6 W', lumens: '420 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 180 × H 400 mm', finish: 'Twisted ceramic · Glazed ivory',
        application: { es: 'Recibidores y rincones decorativos', en: 'Entries and decorative vignettes' },
        description: {
          es: 'Un cuerpo cerámico torsionado a mano atrapa la luz en sus crestas. Oficio y brillo en igual medida.',
          en: 'A hand-twisted ceramic body catches light along its ridges. Craft and glow in equal measure.'
        },
        featured: false,
        assets: asset('DVA-Albus Twisted Table Lamp_corona')
      },
      {
        id: 'flat-table', code: 'DVA-5965', name: 'Flat Table', category: 'Table Lamps',
        designer: 'LUXA Studio', power: '10 W', lumens: '720 lm', temperature: '3000 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 180 × H 380 mm', finish: 'Slim aluminium · Matte black',
        application: { es: 'Escritorios y espacios de trabajo', en: 'Desks and workspaces' },
        description: {
          es: 'El lenguaje Flat a escala de escritorio: un disco luminoso sobre un vástago fino, regulable según la tarea o el estado de ánimo.',
          en: 'The Flat language scaled to the desktop: a luminous disc on a fine stem, dimmable to suit the task or the mood.'
        },
        featured: false,
        assets: asset('DVA-5965 Flat Table Lamp_corona')
      },

      // ---------- WALL LIGHTS ----------------------------------------------
      {
        id: 'tempo-wall', code: 'DVA-5756', name: 'Tempo Wall', category: 'Wall Lights',
        designer: 'LUXA Studio', power: '12 W', lumens: '850 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP44', dimensions: 'Ø 200 × D 110 mm', finish: 'Spun aluminium · Matte black',
        application: { es: 'Pasillos y paredes de mesa de luz', en: 'Hallways and bedside walls' },
        description: {
          es: 'La pantalla Tempo girada hacia la pared. Baño hacia arriba y hacia abajo con el mismo carácter suave y sin deslumbre que su hermana colgante.',
          en: 'The Tempo shade turned to the wall. Up-and-down wash with the same gentle, glare-free character as its pendant sibling.'
        },
        featured: true,
        assets: asset('DVA-5756 Tempo Wall Lamp_corona')
      },
      {
        id: '265-wall', code: 'DVA-265', name: '265 Wall', category: 'Wall Lights',
        designer: 'LUXA Studio', power: '10 W', lumens: '700 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Reach 1150 mm · Adjustable arm', finish: 'Painted steel · White',
        application: { es: 'Paredes de lectura y montajes de galería', en: 'Reading walls and gallery hangs' },
        description: {
          es: 'Un brazo contrapesado lleva la luz adonde se la quiera. Un clásico minimalista del aplique ajustable.',
          en: 'A counterweighted arm sweeps light wherever it is wanted. A minimalist classic of adjustable wall lighting.'
        },
        featured: false,
        assets: asset('DVA-265 Wall Lamp_corona')
      },
      {
        id: 'aballs-a-wall', code: 'DVA-ABW', name: 'Aballs A Wall', category: 'Wall Lights',
        designer: 'LUXA Studio', power: '8 W', lumens: '560 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP44', dimensions: 'Ø 200 × D 230 mm', finish: 'Opal sphere · Brushed brass',
        application: { es: 'Baños y tocadores', en: 'Bathrooms and vanities' },
        description: {
          es: 'Un globo opal sobre una placa de latón — luz pareja y favorecedora para espejos y tocadores, apto para zonas húmedas.',
          en: 'An opal globe on a brass plate — flattering, even light for mirrors and vanities, rated for damp rooms.'
        },
        featured: false,
        assets: asset('DVA-Aballs A Wall Light_corona')
      },
      {
        id: 'lighto-a-wall', code: 'DVA-LTW', name: 'Lighto A Wall', category: 'Wall Lights',
        designer: 'LUXA Studio', power: '7 W', lumens: '500 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP44', dimensions: 'Ø 180 × D 200 mm', finish: 'Opal sphere · Brushed brass',
        application: { es: 'Baños y zonas húmedas', en: 'Bathrooms and damp areas' },
        description: {
          es: 'Un globo opal sobre una pieza de latón cepillado — luz pareja y suave para el espejo, apto para baño.',
          en: 'An opal globe on brushed brass — even, flattering light for the mirror, damp-rated for bathrooms.'
        },
        featured: false,
        assets: asset('DVA-Lighto A Wall Light_corona')
      },
      {
        id: 'arum-wall', code: 'DVA-ARW', name: 'Arum Wall', category: 'Wall Lights',
        designer: 'LUXA Studio', power: '9 W', lumens: '620 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 220 × D 130 mm', finish: 'Pleated metal · Brass',
        application: { es: 'Livings y pasillos', en: 'Living rooms and corridors' },
        description: {
          es: 'El plisado Arum como flor de pared, proyectando un abanico de luz cálida sobre la superficie en la que apoya.',
          en: 'The Arum pleat as a wall flower, casting a fan of warm light up the surface it rests against.'
        },
        featured: false,
        assets: asset('DVA-Arum Wall Lamp_corona')
      },

      // ---------- CEILING LIGHTS -------------------------------------------
      {
        id: 'aballs-a-ceiling', code: 'DVA-ABC', name: 'Aballs A II Ceiling', category: 'Ceiling Lights',
        designer: 'LUXA Studio', power: '12 W', lumens: '900 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP44', dimensions: 'Ø 250 × D 250 mm', finish: 'Opal sphere · Brushed brass',
        application: { es: 'Techos bajos, halls y baños', en: 'Low ceilings, halls and bathrooms' },
        description: {
          es: 'Un globo opal de superficie que abraza el techo. La suavidad Aballs allí donde un colgante quedaría demasiado bajo.',
          en: 'A surface-mounted opal globe that hugs the ceiling. The Aballs softness where a pendant would hang too low.'
        },
        featured: false,
        assets: asset('DVA-Aballs A II Ceiling Light_corona')
      },
      {
        id: 'lighto-c-ceiling', code: 'DVA-LTC', name: 'Lighto C Ceiling', category: 'Ceiling Lights',
        designer: 'LUXA Studio', power: '11 W', lumens: '850 lm', temperature: '2700 K',
        cri: '≥ 90', ip: 'IP44', dimensions: 'Ø 230 × D 230 mm', finish: 'Opal sphere · Brushed brass',
        application: { es: 'Baños, halls y techos bajos', en: 'Bathrooms, halls and low ceilings' },
        description: {
          es: 'Un globo opal de superficie con base de latón — luz general suave y atmosférica, calmando el ambiente desde arriba.',
          en: 'A surface-mounted opal globe with a brass base — soft, atmospheric ambient light from above.'
        },
        featured: false,
        assets: asset('DVA-Lighto C Ceiling Light_corona')
      },
      {
        id: 'bo32-ceiling', code: 'DVA-BO32', name: 'BO 32 Surface Ceiling', category: 'Ceiling Lights',
        designer: 'LUXA Studio', power: '16 W', lumens: '1300 lm', temperature: '3000 K',
        cri: '≥ 90', ip: 'IP20', dimensions: 'Ø 320 × D 70 mm', finish: 'Aluminium · Matte white',
        application: { es: 'Cocinas, pasillos y retail', en: 'Kitchens, corridors and retail' },
        description: {
          es: 'Un disco de superficie limpio con reflector profundo anti-deslumbramiento. Embutido, moderno y silenciosamente eficiente.',
          en: 'A clean surface disc with a deep anti-glare reflector. Flush, modern and quietly efficient.'
        },
        featured: false,
        assets: asset('DVA-BO 32 Surface Ceiling Light_corona')
      },

      // ---------- DOWNLIGHTS -----------------------------------------------
      {
        id: 'bitpop-downlight', code: 'DVA-BIT', name: 'Bitpop C 2.2 Downlight', category: 'Downlights',
        designer: 'LUXA Studio', power: '9 W', lumens: '780 lm', temperature: '3000 K',
        cri: '≥ 90', ip: 'IP44', dimensions: 'Ø 85 × cut-out Ø 75 mm', finish: 'Trimless · Matte white',
        application: { es: 'Iluminación general y de acento en techo', en: 'General and accent ceiling lighting' },
        description: {
          es: 'Un downlight empotrado compacto con celda profunda para cortar el deslumbramiento. Desaparece en el techo, dejando solo la luz.',
          en: 'A compact recessed downlight with a deep cell to cut glare. Disappears into the ceiling, leaving only the light.'
        },
        featured: false,
        assets: asset('DVA-Bitpop C 2.2 Recessed Downlight_corona')
      },
      {
        id: 'came-downlight', code: 'DVA-CAM', name: 'Came 2.6 Downlight', category: 'Downlights',
        designer: 'LUXA Studio', power: '13 W', lumens: '1050 lm', temperature: '3000 K',
        cri: '≥ 90', ip: 'IP44', dimensions: 'Ø 95 × cut-out Ø 85 mm', finish: 'Adjustable trim · Black baffle',
        application: { es: 'Aplicaciones de acento y baño de pared', en: 'Accent and wall-wash applications' },
        description: {
          es: 'Un spot empotrado orientable para rasar paredes y resaltar obras de arte. Óptica precisa en un cuerpo discreto y ajustable.',
          en: 'A tilting recessed spot for grazing walls and highlighting art. Precise optics in a discreet, adjustable body.'
        },
        featured: false,
        assets: asset('DVA-Came 2.6 Recessed Downlight_corona')
      }
    ],

    /* ----------------------------------------------------------------------- */
    /* Spaces are entirely loaded from data/spaces.json at runtime — populated
       by the Space Planner pipeline. Curated placeholder scenes were removed on
       2026-06-09 because their renders were stock images, not real catalog
       products. Add curated scenes back here only if they use real renders +
       real catalog products. */
    spaces: [],

    /* ----------------------------------------------------------------------- */
    downloads: [
      {
        id: 'general-catalog',
        title:       { es: 'Catálogo General 2026', en: 'LUXA General Catalog 2026' },
        kind: 'Catalog',
        pages:       { es: '128 pp · PDF', en: '128 pp · PDF' },
        file: 'assets/pdfs/luxa-general-catalog-2026.pdf',
        description: {
          es: 'La colección completa — cada familia, acabado y dato fotométrico en un solo volumen.',
          en: 'The complete collection — every family, finish and photometric figure in one volume.'
        }
      },
      {
        id: 'downlights-sheet',
        title:       { es: 'Ficha Técnica de Downlights', en: 'Downlights Technical Sheet' },
        kind: 'Technical',
        pages:       { es: '12 pp · PDF', en: '12 pp · PDF' },
        file: 'assets/pdfs/downlights-technical-sheet.pdf',
        description: {
          es: 'Aberturas, ángulos de haz, opciones de driver y grados IP de la familia empotrada.',
          en: 'Cut-outs, beam angles, driver options and IP ratings for the recessed range.'
        }
      },
      {
        id: 'spotlights-collection',
        title:       { es: 'Colección de Spotlights', en: 'Spotlights Collection' },
        kind: 'Collection',
        pages:       { es: '24 pp · PDF', en: '24 pp · PDF' },
        file: 'assets/pdfs/spotlights-collection.pdf',
        description: {
          es: 'Iluminación de acento ajustable y para riel, para retail y residencial.',
          en: 'Adjustable and track-mounted accent lighting for retail and residential.'
        }
      },
      {
        id: 'linear-systems-guide',
        title:       { es: 'Guía de Sistemas Lineales', en: 'Linear Systems Guide' },
        kind: 'Guide',
        pages:       { es: '36 pp · PDF', en: '36 pp · PDF' },
        file: 'assets/pdfs/linear-systems-guide.pdf',
        description: {
          es: 'Perfiles de carrera continua, conectores y detalles de suspensión y empotrado.',
          en: 'Continuous-run profiles, connectors and suspension details for architectural lines.'
        }
      }
    ],

    /* ----------------------------------------------------------------------- */
    about: {
      intro: {
        es: 'LUXA es una marca ficticia de iluminación creada para demostrar cómo las experiencias interactivas de producto pueden transformar los catálogos tradicionales en potentes herramientas de venta.',
        en: 'LUXA is a fictional lighting brand created to demonstrate how interactive product experiences can transform traditional catalogs into powerful sales tools.'
      },
      pillars: [
        {
          title: { es: 'Visualización de Producto', en: 'Product Visualization' },
          text: {
            es: 'Renders de alta fidelidad presentados como una experiencia, no como un PDF — cada luminaria explorada en sus propios términos.',
            en: 'High-fidelity renders presented as an experience, not a PDF — every fixture explored on its own terms.'
          }
        },
        {
          title: { es: 'Catálogos Interactivos', en: 'Interactive Catalogs' },
          text: {
            es: 'Filtrá, guardá y compará en una sola superficie fluida. El catálogo responde; no solo muestra.',
            en: 'Filter, favorite and compare in a single fluid surface. The catalog responds; it does not just display.'
          }
        },
        {
          title: { es: 'Iluminación en Contexto', en: 'Lighting in Context' },
          text: {
            es: 'Mirá las luminarias aplicadas conceptualmente en ambientes reales — living, dormitorio, baño — a través de hotspots simples y clickeables.',
            en: 'See fixtures applied conceptually in real spaces — living, bedroom, bathroom — through simple, clickable hotspots.'
          }
        },
        {
          title: { es: 'Recursos Técnicos', en: 'Technical Resources' },
          text: {
            es: 'Fichas técnicas, datos fotométricos y documentos descargables, listos para especificadores y diseñadores.',
            en: 'Specification sheets, photometric data and downloadable documents, ready for specifiers and designers.'
          }
        }
      ]
    }
  };

  /* =============================================================================
     Dynamic spaces — multi-catalog Space Planner pipeline
     -----------------------------------------------------------------------------
     The Space Planner exports approved scenes per catalog into
     data/spaces.<catalogId>.json. On boot we:
       1. Read space-planner/catalogs.json to discover which catalogs exist.
       2. For each catalog, fetch data/spaces.<id>.json (if present).
       3. Tag each entry with its source catalog (_catalog) so the UI can filter.
       4. Merge into window.LUXA.spaces:
            · Same id → planner entry replaces curated entry
            · New id  → planner entry is appended
            · Catalog metadata is exposed on window.LUXA.catalogs
     Backwards compatibility: if catalogs.json is not found we fall back to
     the legacy single-file data/spaces.json so older setups keep working.
     ========================================================================== */
  (function mergeDynamicSpaces() {
    if (typeof fetch !== 'function') return;

    function safeFetchJSON(path) {
      return fetch(path, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }

    function entriesOf(json) {
      if (!json) return [];
      if (Array.isArray(json.entries)) return json.entries;
      if (Array.isArray(json.spaces))  return json.spaces;
      return [];
    }

    function applyMerge(allEntries, catalogList) {
      var spaces = window.LUXA.spaces || [];
      var byId = {};
      spaces.forEach(function (s, i) { byId[s.id] = i; });
      allEntries.forEach(function (e) {
        if (!e || !e.id) return;
        if (byId[e.id] != null) spaces[byId[e.id]] = e;
        else { spaces.push(e); byId[e.id] = spaces.length - 1; }
      });
      window.LUXA.spaces = spaces;
      window.LUXA.catalogs = catalogList || [];
      if (window.LUXA_App && typeof window.LUXA_App.refreshSpaces === 'function') {
        window.LUXA_App.refreshSpaces();
      }
    }

    safeFetchJSON('space-planner/catalogs.json').then(function (idx) {
      var ids = idx && Array.isArray(idx.catalogs) ? idx.catalogs : null;
      if (!ids || !ids.length) {
        // Legacy fallback: single file at the root data folder.
        return safeFetchJSON('data/spaces.json').then(function (json) {
          var entries = entriesOf(json);
          if (entries.length) applyMerge(entries, []);
        });
      }

      // Load each catalog's meta + its spaces file in parallel
      var jobs = ids.map(function (id) {
        return Promise.all([
          safeFetchJSON('space-planner/catalogs/' + id + '/meta.json'),
          safeFetchJSON('data/spaces.' + id + '.json')
        ]).then(function (pair) {
          var meta = pair[0] || {};
          var spacesJson = pair[1];
          var entries = entriesOf(spacesJson).map(function (e) {
            return Object.assign({}, e, { _catalog: id });
          });
          return {
            id: id,
            name: meta.name || id,
            description: meta.description || '',
            entries: entries
          };
        });
      });

      return Promise.all(jobs).then(function (results) {
        var allEntries = [];
        var catalogList = results.map(function (r) {
          allEntries = allEntries.concat(r.entries);
          return { id: r.id, name: r.name, description: r.description, count: r.entries.length };
        });
        applyMerge(allEntries, catalogList);
      });
    });
  })();

  /* =============================================================================
     Dynamic products — Product Data Generator pipeline
     -----------------------------------------------------------------------------
     Mirrors the spaces pipeline above. Per-catalog sidecar JSON at
     data/products.<catalogId>.json is fetched and merged into
     window.LUXA.products. Same id → replace curated entry; new id → append.
     ========================================================================== */
  (function mergeDynamicProducts() {
    if (typeof fetch !== 'function') return;

    function safeFetchJSON(path) {
      return fetch(path, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }

    function entriesOf(json) {
      if (!json) return [];
      if (Array.isArray(json.entries))  return json.entries;
      if (Array.isArray(json.products)) return json.products;
      if (Array.isArray(json))          return json;
      return [];
    }

    function removedOf(json) {
      if (!json) return [];
      return Array.isArray(json.removed) ? json.removed : [];
    }

    function applyMerge(allEntries, allRemoved) {
      var products = window.LUXA.products || [];
      var byId = {};
      products.forEach(function (p, i) { byId[p.id] = i; });
      // Add/replace: per-id, the sidecar entry wins over the curated entry.
      allEntries.forEach(function (e) {
        if (!e || !e.id) return;
        if (byId[e.id] != null) products[byId[e.id]] = e;
        else { products.push(e); byId[e.id] = products.length - 1; }
      });
      // Subtract: every catalogId in the sidecar's `removed` list disappears,
      // even if it came from the static catalog.data.js block. Without this,
      // a removed curated product would still show up in the app.
      if (allRemoved && allRemoved.length) {
        var removedSet = Object.create(null);
        allRemoved.forEach(function (id) { if (id) removedSet[id] = true; });
        products = products.filter(function (p) { return !removedSet[p.id]; });
      }
      window.LUXA.products = products;
      if (window.LUXA_App && typeof window.LUXA_App.refreshProducts === 'function') {
        window.LUXA_App.refreshProducts();
      }
    }

    safeFetchJSON('space-planner/catalogs.json').then(function (idx) {
      var ids = idx && Array.isArray(idx.catalogs) ? idx.catalogs : null;
      if (!ids || !ids.length) return;

      var jobs = ids.map(function (id) {
        return safeFetchJSON('data/products.' + id + '.json').then(function (json) {
          var entries = entriesOf(json).map(function (e) {
            return Object.assign({}, e, { _catalog: id });
          });
          return { entries: entries, removed: removedOf(json) };
        });
      });

      return Promise.all(jobs).then(function (results) {
        var allEntries = [];
        var allRemoved = [];
        results.forEach(function (r) {
          allEntries = allEntries.concat(r.entries);
          allRemoved = allRemoved.concat(r.removed);
        });
        if (allEntries.length || allRemoved.length) applyMerge(allEntries, allRemoved);
      });
    });
  })();

  /* =============================================================================
     Color variants — per-product color swatches in the catalog view
     -----------------------------------------------------------------------------
     Reads data/color-variants.json. Each entry maps a render filename basename
     (e.g. "DVA-BO 32 Surface Ceiling Light_corona") to a list of color options
     [{id, image}]. For each product whose assets.image basename matches a key,
     we attach p.colorVariants. The product card and detail panel render the
     swatches conditionally. Default color = the one whose image matches the
     product's original assets.image; if none match, the first variant.
     ========================================================================== */
  (function mergeColorVariants() {
    if (typeof fetch !== 'function') return;
    // Save the manifest globally so the app can re-apply it after every
    // sidecar merge replaces product objects (otherwise the colorVariants
    // attached here gets blown away by the products.json merge that runs in
    // parallel and tends to finish slightly later).
    fetch('data/color-variants.json', { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (json) {
        if (!json || !json.variants) return;
        window.LUXA._colorVariantsByBasename = json.variants;
        if (window.LUXA_App && typeof window.LUXA_App.refreshProducts === 'function') {
          window.LUXA_App.refreshProducts();
        }
      })
      .catch(function () { /* manifest is optional — silently skip */ });
  })();
})();
