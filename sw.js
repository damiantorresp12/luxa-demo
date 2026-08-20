/* =============================================================================
   EL GUARDIÁN — hace que el showroom funcione sin internet
   -----------------------------------------------------------------------------
   Este archivo corre aparte de la app, en segundo plano, dentro del navegador.
   Su trabajo es guardar una copia de todo el showroom en el dispositivo del
   cliente, y después servirla desde ahí — con señal o sin señal.

   CÓMO TRABAJA
     1. Al instalarse guarda el "armazón": la página, los estilos, el código,
        las tipografías y los datos. Es medio mega, tarda un segundo.
        Con eso la app ya abre sin internet.
     2. Después, en segundo plano y sin apurar al cliente, se va bajando lo
        pesado: las fotos de producto, los ambientes y por último los videos.
        Si alguno falla no pasa nada — se pedirá por internet cuando haga falta.
     3. A partir de ahí, cada archivo se sirve primero desde la copia guardada.

   QUÉ PASA CUANDO PUBLICÁS CAMBIOS
     La lista de archivos (offline-files.json) lleva una "version". Cuando
     cambia, este guardián borra la copia vieja y guarda la nueva. El cliente
     ve los cambios la próxima vez que abre la app.

   NO SE EDITA A MANO PARA AGREGAR ARCHIVOS: la lista se genera con
   tools/build-offline-list.ps1.
   ========================================================================== */

'use strict';

var LISTA   = 'offline-files.json';
var PREFIJO = 'luxa-offline-';

/* Los archivos se guardan por su ruta limpia ('css/styles.css'), pero la página
   los pide con la marca de versión pegada atrás ('css/styles.css?v=11'). Sin
   esto no los reconocería como el mismo archivo y sin internet la app abriría
   sin estilos y sin datos. */
var IGNORAR_VERSION = { ignoreSearch: true };

/* El nombre del cajón donde se guarda todo. Lleva la versión adentro, así una
   versión nueva estrena cajón y el viejo se tira. */
var cajonActual = null;

function nombreCajon(version) { return PREFIJO + version; }

function leerLista() {
  return fetch(LISTA, { cache: 'no-store' }).then(function (r) {
    if (!r.ok) throw new Error('no se pudo leer ' + LISTA);
    return r.json();
  });
}

/* ---------------------------------------------------------------------------
   INSTALACIÓN — guarda el armazón. Si esto falla, la instalación falla.
   ------------------------------------------------------------------------ */
self.addEventListener('install', function (evento) {
  evento.waitUntil(
    leerLista().then(function (lista) {
      cajonActual = nombreCajon(lista.version);
      return caches.open(cajonActual).then(function (cajon) {
        return cajon.addAll(lista.armazon);
      });
    }).then(function () {
      // Entrar en servicio sin esperar a que el cliente cierre las pestañas.
      return self.skipWaiting();
    })
  );
});

/* ---------------------------------------------------------------------------
   ACTIVACIÓN — tira los cajones viejos y arranca la bajada de lo pesado.
   ------------------------------------------------------------------------ */
self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    leerLista().then(function (lista) {
      var vigente = nombreCajon(lista.version);
      cajonActual = vigente;

      return caches.keys().then(function (nombres) {
        return Promise.all(nombres.map(function (n) {
          // Solo toca sus propios cajones, por si el sitio guarda otras cosas.
          if (n.indexOf(PREFIJO) === 0 && n !== vigente) return caches.delete(n);
          return null;
        }));
      }).then(function () {
        return self.clients.claim();
      }).then(function () {
        // La bajada de lo pesado NO va dentro del waitUntil: si tardara,
        // el navegador podría matar al guardián por demorarse demasiado.
        guardarPesados(lista);
      });
    })
  );
});

/* ---------------------------------------------------------------------------
   LO PESADO — de a uno, sin bloquear, tolerando fallas.
   ------------------------------------------------------------------------ */
var bajando = false;

function guardarPesados(lista) {
  if (bajando) return;
  bajando = true;

  var pendientes = (lista.pesados || []).slice();
  var total      = pendientes.length;
  var listos     = 0;
  var fallados   = 0;

  caches.open(nombreCajon(lista.version)).then(function (cajon) {

    function siguiente() {
      if (!pendientes.length) {
        bajando = false;
        avisar({
          tipo: 'offline-listo',
          guardados: listos,
          fallados: fallados,
          total: total
        });
        return;
      }

      var ruta = pendientes.shift();

      // Si ya está guardado de una versión anterior de esta misma bajada,
      // no lo pide de nuevo.
      cajon.match(ruta).then(function (yaEsta) {
        if (yaEsta) { listos++; return null; }
        return fetch(ruta, { cache: 'no-store' }).then(function (r) {
          if (!r || !r.ok) throw new Error(ruta);
          return cajon.put(ruta, r);
        }).then(function () { listos++; });
      }).catch(function () {
        // Un archivo que falla no arruina la bajada entera.
        fallados++;
      }).then(function () {
        if ((listos + fallados) % 20 === 0) {
          avisar({
            tipo: 'offline-progreso',
            guardados: listos + fallados,
            total: total
          });
        }
        siguiente();
      });
    }

    siguiente();
  });
}

function avisar(mensaje) {
  self.clients.matchAll().then(function (clientes) {
    clientes.forEach(function (c) { c.postMessage(mensaje); });
  });
}

/* ---------------------------------------------------------------------------
   PEDIDOS — de dónde sale cada archivo
   ------------------------------------------------------------------------ */
self.addEventListener('fetch', function (evento) {
  var pedido = evento.request;

  // Solo lecturas y solo de este mismo sitio. Lo de afuera (WhatsApp) pasa de
  // largo sin que el guardián se meta.
  if (pedido.method !== 'GET') return;
  var url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;

  // Los pedidos que empiezan con /__ son la mini-API del servidor local que
  // usan el Generador y el Planificador (listar carpetas, guardar, subir).
  // Tienen que salir SIEMPRE en vivo: si se guardara una copia, Damian vería
  // listas de archivos viejas y creería que algo no se guardó.
  if (url.pathname.indexOf('/__') === 0) return;

  // Las herramientas internas (Generador y Planificador) quedan siempre en
  // vivo: son de Damian, no del cliente, y guardar una copia solo confunde.
  if (url.pathname.indexOf('/space-planner/') !== -1 ||
      url.pathname.indexOf('/product-data-generator/') !== -1) {
    // Las fichas de catálogo sí las necesita la app.
    if (url.pathname.indexOf('.json') === -1) return;
  }

  // La página y los datos: primero se intenta la versión fresca, y si no hay
  // internet se cae a la copia guardada. Así los cambios llegan enseguida.
  var esPagina = pedido.mode === 'navigate';
  var esDatos  = url.pathname.indexOf('.json') !== -1;

  if (esPagina || esDatos) {
    evento.respondWith(
      fetch(pedido).then(function (r) {
        if (r && r.ok) {
          var copia = r.clone();
          caches.open(cajonActual || PREFIJO + 'temp').then(function (cajon) {
            cajon.put(esPagina ? './' : pedido, copia);
          });
        }
        return r;
      }).catch(function () {
        return caches.match(esPagina ? './' : pedido, IGNORAR_VERSION).then(function (guardado) {
          return guardado || caches.match('./');
        });
      })
    );
    return;
  }

  // Todo lo demás (fotos, videos, estilos, código, tipografías): primero la
  // copia guardada, que es instantánea. Si no está, se pide y se guarda.
  evento.respondWith(
    caches.match(pedido, IGNORAR_VERSION).then(function (guardado) {
      if (guardado) return guardado;
      return fetch(pedido).then(function (r) {
        if (r && r.ok && cajonActual) {
          var copia = r.clone();
          caches.open(cajonActual).then(function (cajon) { cajon.put(pedido, copia); });
        }
        return r;
      });
    })
  );
});
