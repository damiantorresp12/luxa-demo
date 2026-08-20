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
    if (!r.ok) throw new Error('sin lista');
    return r.json();
  }).catch(function () {
    /* Sin señal, la lista sale de la copia guardada (viaja en el armazón).
       Sin esto, offline el guardián no sabe ni qué debería tener, y el cartel
       del menú no aparece. */
    return caches.match(LISTA, IGNORAR_VERSION).then(function (guardada) {
      if (!guardada) throw new Error('no se pudo leer ' + LISTA);
      return guardada.json();
    });
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

/* Cómo viene la descarga.

   OJO: este contador vive solo mientras el guardián está despierto, y el
   celular lo apaga apenas salís de la app. Por eso NO se puede confiar en él
   para saber si falta bajar algo: hay que contar lo que hay guardado de
   verdad. Para eso está estadoReal(). */
var avance = { guardados: 0, total: 0, terminado: false };

/* Cuenta lo que REALMENTE está guardado, mirando la copia en vez del
   contador. Es la única fuente confiable después de que el celular apagó y
   volvió a encender al guardián. */
function estadoReal() {
  return leerLista().then(function (lista) {
    var total = (lista.pesados || []).length;
    return caches.open(nombreCajon(lista.version)).then(function (cajon) {
      return cajon.keys();
    }).then(function (guardadas) {
      // Las claves guardadas incluyen el armazón; solo interesan los pesados.
      var tengo = Object.create(null);
      guardadas.forEach(function (p) { tengo[p.url] = true; });

      var listos = 0;
      (lista.pesados || []).forEach(function (rel) {
        if (tengo[new URL(rel, self.location.origin).href]) listos++;
      });

      return { guardados: listos, total: total, terminado: listos >= total, lista: lista };
    });
  });
}

/* Devuelve una promesa que termina cuando termina la bajada. Es importante que
   la devuelva: quien la llama la mete en waitUntil() y eso mantiene despierto
   al guardián mientras trabaja. */
function guardarPesados(lista) {
  if (bajando) return bajando;

  var pendientes = (lista.pesados || []).slice();
  var total      = pendientes.length;
  var listos     = 0;
  var fallados   = 0;

  avance = { guardados: 0, total: total, terminado: false };

  bajando = caches.open(nombreCajon(lista.version)).then(function (cajon) {
    return new Promise(function (fin) {

      function siguiente() {
        if (!pendientes.length) {
          avance = { guardados: listos, total: total, terminado: true };
          avisar({
            tipo: 'offline-listo',
            guardados: listos,
            fallados: fallados,
            total: total
          });
          fin();
          return;
        }

        var ruta = pendientes.shift();

        // Lo que ya está guardado no se vuelve a pedir. Esto es lo que hace
        // barata la reanudación: al retomar, pasa volando por lo que ya bajó.
        cajon.match(ruta).then(function (yaEsta) {
          if (yaEsta) { listos++; return null; }
          return fetch(ruta, { cache: 'no-store' }).then(function (r) {
            if (!r || r.status !== 200) throw new Error(ruta);
            return cajon.put(ruta, r);
          }).then(function () { listos++; });
        }).catch(function () {
          // Un archivo que falla no arruina la bajada entera.
          fallados++;
        }).then(function () {
          avance.guardados = listos + fallados;
          if (avance.guardados % 10 === 0) {
            avisar({
              tipo: 'offline-progreso',
              guardados: avance.guardados,
              total: total
            });
          }
          siguiente();
        });
      }

      siguiente();
    });
  }).then(function () {
    bajando = false;
  }).catch(function () {
    bajando = false;
  });

  return bajando;
}

/* ---------------------------------------------------------------------------
   VIDEOS — el caso especial

   Una imagen se pide entera de una vez. Un video NO: el reproductor pide
   "dame del byte 0 al 1023", después otro pedazo, y así. Eso se llama pedido
   por rango, y la respuesta correcta es un 206 con SOLO ese pedazo.

   La copia guardada tiene el archivo entero, así que si se la devolvemos tal
   cual estamos contestando 200 con todo. Chrome lo perdona; Safari no, y en
   iPhone y iPad el video no arranca.

   Esta función recorta el pedazo pedido y arma la respuesta como corresponde.
   ------------------------------------------------------------------------ */
function responderPorRango(pedido, guardado) {
  var rango = pedido.headers.get('range');
  if (!rango) return Promise.resolve(guardado);

  var m = /bytes=(\d*)-(\d*)/.exec(rango);
  if (!m) return Promise.resolve(guardado);

  return guardado.blob().then(function (entero) {
    var total  = entero.size;
    var desde  = m[1] ? parseInt(m[1], 10) : 0;
    var hasta  = m[2] ? parseInt(m[2], 10) : total - 1;

    // Si pide "los últimos N bytes" viene como 'bytes=-500'
    if (!m[1] && m[2]) { desde = Math.max(0, total - parseInt(m[2], 10)); hasta = total - 1; }
    if (hasta >= total) hasta = total - 1;

    if (desde > hasta || desde >= total) {
      return new Response(null, {
        status: 416,
        statusText: 'Range Not Satisfiable',
        headers: { 'Content-Range': 'bytes */' + total }
      });
    }

    return new Response(entero.slice(desde, hasta + 1), {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type':   guardado.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Length': String(hasta - desde + 1),
        'Content-Range':  'bytes ' + desde + '-' + hasta + '/' + total,
        'Accept-Ranges':  'bytes'
      }
    });
  });
}

function avisar(mensaje) {
  self.clients.matchAll().then(function (clientes) {
    clientes.forEach(function (c) { c.postMessage(mensaje); });
  });
}

/* La página pregunta "¿cómo venís?" al abrirse, y el guardián le contesta con
   lo que tenga. Así el cartel del menú dice la verdad en cualquier visita, no
   solo la primera. */
self.addEventListener('message', function (evento) {
  var m = evento.data || {};
  if (m.tipo !== 'estado') return;

  /* waitUntil mantiene al guardián despierto mientras trabaja. Sin esto el
     celular lo apaga a los pocos segundos y la descarga se corta. */
  evento.waitUntil(
    estadoReal().then(function (real) {
      if (evento.source && evento.source.postMessage) {
        evento.source.postMessage(
          real.terminado
            ? { tipo: 'offline-listo',    guardados: real.guardados, total: real.total, fallados: 0 }
            : { tipo: 'offline-progreso', guardados: real.guardados, total: real.total }
        );
      }

      /* SI FALTA ALGO, SEGUIR BAJANDO DESDE DONDE QUEDÓ.
         Esto es lo que hace que la descarga sobreviva a que el cliente cierre
         la app: cada vez que la vuelve a abrir, retoma. */
      if (!real.terminado) return guardarPesados(real.lista);
      return null;
    }).catch(function () { /* sin señal: se retoma la próxima vez */ })
  );
});

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

  /* --------------------------------------------------------------------------
     LA REGLA DE FONDO — de dónde sale cada cosa

     · El CÓDIGO de la app (la página, los estilos, los scripts, los datos):
       PRIMERO INTERNET, y la copia guardada solo si no hay señal.
       Es obligatorio que sea así: si saliera de la copia, un cambio publicado
       no le llegaría nunca al cliente — se quedaría con la versión del día que
       instaló la app, para siempre.

     · Lo PESADO (fotos, videos, tipografías, PDF): primero la copia guardada,
       que es instantánea y no gasta datos. Estos archivos no cambian: cuando
       se reemplaza un render, cambia la lista y el guardián baja la versión
       nueva por su cuenta.
     ----------------------------------------------------------------------- */
  var esPagina = pedido.mode === 'navigate';
  var esCodigo = /\.(css|js|json|webmanifest)$/i.test(url.pathname);

  if (esPagina || esCodigo) {
    evento.respondWith(
      fetch(pedido).then(function (r) {
        if (r && r.status === 200) {
          var copia = r.clone();
          caches.open(cajonActual || PREFIJO + 'temp').then(function (cajon) {
            cajon.put(esPagina ? './' : pedido, copia);
          }).catch(function () { /* sin espacio: la app sigue andando */ });
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

  // Lo pesado: primero la copia guardada. Si no está, se pide y se guarda.
  evento.respondWith(
    caches.match(pedido, IGNORAR_VERSION).then(function (guardado) {
      // Si el reproductor pidió un pedazo, hay que recortarlo (ver arriba).
      if (guardado) return responderPorRango(pedido, guardado);

      return fetch(pedido).then(function (r) {
        // Solo se guardan respuestas completas: una respuesta "por pedazos"
        // (206) no se puede guardar, y guardarla rompería la copia.
        if (r && r.status === 200 && cajonActual) {
          var copia = r.clone();
          caches.open(cajonActual).then(function (cajon) {
            cajon.put(pedido, copia);
          }).catch(function () { /* sin espacio o no cacheable: no pasa nada */ });
        }
        return r;
      });
    })
  );
});
