/* =============================================================================
   INSTALAR EN EL DISPOSITIVO Y GUARDAR EL CATÁLOGO — pwa.js
   -----------------------------------------------------------------------------
   EL ORDEN DE LAS COSAS, QUE ES LO IMPORTANTE ACÁ:

     1. Al entrar solo se ve un botón. NO se descarga nada.
     2. La persona lo toca: en Android se instala el ícono; en iPhone se le
        muestra el paso a mano (Apple no permite instalar por botón). En los
        dos casos, ahí recién arranca la descarga del catálogo.
     3. Aparece el porcentaje mientras baja.
     4. Al terminar: "Catálogo guardado en este dispositivo".

   Por qué no se baja solo: son más de 100 MB. Nadie los pidió por abrir un
   link, y con datos del celular sería una falta de respeto. Se ofrece, no se
   impone.

   El nombre y el ícono con los que se instala salen de manifest.webmanifest,
   que se genera con tools/aplicar-marca.ps1 desde js/brand.config.js.
   ========================================================================== */

(function () {
  'use strict';

  /* Guardar el catálogo necesita una conexión segura. Abriendo por
     http://localhost anda igual; en internet el sitio ya va por https. */
  var puedeGuardar = ('serviceWorker' in navigator) &&
                     (location.protocol === 'https:' || location.hostname === 'localhost');

  var PEDIDO_KEY = 'luxa.offline.pedido';   // la persona ya tocó el botón

  var promesaInstalar = null;   // la ofrece el navegador, se usa una sola vez
  var boton      = null;
  var estadoEl   = null;
  var consultas  = null;
  var completo   = false;

  /* --- Textos ------------------------------------------------------------- */

  var TEXTOS = {
    es: {
      instalarYGuardar: 'Instalar app',
      soloGuardar:      'Guardar catálogo',
      apple:            'Para instalar el ícono: tocá Compartir y elegí “Agregar a inicio”. Mientras tanto, el catálogo se está guardando.',
      guardando:        'Guardando catálogo · {pct}%',
      listo:            '✓ Catálogo guardado en este dispositivo',
      parcial:          'Guardado a medias · {n} de {total}',
      sinEspacio:       'No hay espacio para guardar el catálogo acá'
    },
    en: {
      instalarYGuardar: 'Install app',
      soloGuardar:      'Save catalog',
      apple:            'To install the icon: tap Share and choose “Add to Home Screen”. The catalog is being saved meanwhile.',
      guardando:        'Saving catalog · {pct}%',
      listo:            '✓ Catalog saved on this device',
      parcial:          'Partially saved · {n} of {total}',
      sinEspacio:       'Not enough space to save the catalog here'
    }
  };

  function idioma() {
    try {
      var l = localStorage.getItem('luxa.lang');
      return (l === 'en') ? 'en' : 'es';
    } catch (e) { return 'es'; }
  }
  function t(k) { return TEXTOS[idioma()][k]; }

  function yaPidio() {
    try { return localStorage.getItem(PEDIDO_KEY) === '1'; } catch (e) { return false; }
  }
  function marcarPedido() {
    try { localStorage.setItem(PEDIDO_KEY, '1'); } catch (e) {}
  }

  function yaEstaInstalada() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  function esApple() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           // El iPad moderno se hace pasar por Mac; se delata por el tacto.
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  /* --- Encender el guardián ----------------------------------------------- */

  if (puedeGuardar) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function () {
        return navigator.serviceWorker.ready;
      }).then(function () {
        /* Si ya lo había pedido en otra visita, retomar donde quedó. Si no,
           solo preguntar cómo está la cosa, sin bajar nada. */
        preguntar(yaPidio());
        if (yaPidio()) arrancarConsultas();
      }).catch(function (e) {
        console.warn('[offline] no se pudo activar:', e && e.message);
      });
    });

    navigator.serviceWorker.addEventListener('message', function (ev) {
      var m = ev.data || {};

      if (m.tipo === 'offline-progreso') {
        if (!yaPidio()) return;   // aún no lo pidió: no mostrar nada
        var pct = m.total ? Math.round((m.guardados / m.total) * 100) : 0;
        mostrarEstado(t('guardando').replace('{pct}', pct), false);
        console.log('[offline] guardando… ' + m.guardados + ' de ' + m.total);

      } else if (m.tipo === 'offline-listo') {
        completo = true;
        pararConsultas();
        /* El cartel SOLO se muestra si la persona tocó el botón. Si el
           catálogo ya estaba guardado de antes y ella no pidió nada,
           anunciarlo confunde: no hizo nada para que eso pasara, y ve dos
           mensajes juntos sin haber tocado la pantalla. */
        if (yaPidio()) mostrarEstado(t('listo'), true);
        // El catálogo ya está; el botón se queda solo si falta instalar.
        refrescarBoton();
        console.log('[offline] listo: ' + m.guardados + ' de ' + m.total + ' archivos guardados.');

      } else if (m.tipo === 'offline-incompleto') {
        if (!yaPidio()) return;   // no lo pidió: no se le informa nada
        /* Se recorrió toda la lista pero los archivos no quedaron guardados.
           Pasa cuando el dispositivo no tiene espacio, o en una ventana de
           incógnito, donde el navegador da muy poco lugar y lo borra al
           cerrar. Decirlo, en vez de mentir con un "listo". */
        mostrarEstado(
          m.sinEspacio ? t('sinEspacio')
                       : t('parcial').replace('{n}', m.guardados).replace('{total}', m.total),
          false
        );
        console.warn('[offline] no se pudo guardar todo: ' + m.guardados + ' de ' + m.total +
                     (m.sinEspacio ? ' — el dispositivo no tiene espacio suficiente.' : '.'));
      }
    });
  }

  /* --- Hablar con el guardián ---------------------------------------------
     Cada consulta además lo despierta: el celular lo apaga apenas salís de la
     app, y sin estas consultas la descarga nunca seguiría donde quedó. */

  function preguntar(bajando) {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ tipo: bajando ? 'guardar' : 'estado' });
    }
  }

  function arrancarConsultas() {
    if (consultas) return;
    consultas = setInterval(function () { preguntar(true); }, 15000);
  }

  function pararConsultas() {
    if (consultas) { clearInterval(consultas); consultas = null; }
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && yaPidio() && !completo) preguntar(true);
  });

  /* --- El cartelito de estado --------------------------------------------- */

  function mostrarEstado(texto, esListo) {
    if (!estadoEl) {
      var destino = document.getElementById('sidebarFootCopy');
      if (!destino || !destino.parentNode) return;
      estadoEl = document.createElement('p');
      estadoEl.id = 'offlineEstado';
      estadoEl.className = 'offline-estado';
      destino.parentNode.insertBefore(estadoEl, destino);
    }
    estadoEl.textContent = texto;
    estadoEl.classList.toggle('is-listo', !!esListo);
  }

  /* --- El botón ------------------------------------------------------------ */

  /* SON DOS COSAS DISTINTAS, Y ESTE FUE EL ERROR QUE HUBO QUE ARREGLAR:
       · instalar  = poner el ícono en la pantalla de inicio.
       · guardar   = bajar el catálogo al dispositivo.
     Se puede tener una sin la otra. Si alguien desinstala el ícono pero
     conserva el catálogo guardado, el botón TIENE que volver a aparecer —
     antes no volvía nunca, porque miraba si el catálogo estaba guardado en
     vez de mirar si la app estaba instalada. */

  function faltaInstalar() {
    // Chrome deja de ofrecer la instalación mientras está instalada, y vuelve
    // a ofrecerla al desinstalar. Por eso `promesaInstalar` es la señal buena.
    return !yaEstaInstalada() && (!!promesaInstalar || esApple());
  }
  function faltaGuardar() { return !completo; }

  function refrescarBoton() {
    if (!puedeGuardar) return;

    if (!faltaInstalar() && !faltaGuardar()) { quitarBoton(); return; }

    // Si todavía no guardó el catálogo y ya lo pidió, está bajando: no se le
    // vuelve a ofrecer el botón de guardar por el medio.
    if (!faltaInstalar() && yaPidio()) { quitarBoton(); return; }

    var texto = faltaInstalar() ? t('instalarYGuardar') : t('soloGuardar');

    if (boton) { boton.textContent = texto; return; }

    var destino = document.getElementById('sidebarFootCopy');
    if (!destino || !destino.parentNode) return;

    boton = document.createElement('button');
    boton.type = 'button';
    boton.id = 'btnInstalar';
    boton.className = 'install-btn';
    boton.textContent = texto;
    destino.parentNode.insertBefore(boton, destino);
    boton.addEventListener('click', alTocarElBoton);
  }

  function alTocarElBoton() {
    // 1. El ícono en la pantalla de inicio
    if (promesaInstalar) {
      promesaInstalar.prompt();
      promesaInstalar.userChoice.then(function () {
        promesaInstalar = null;
        // Si lo rechazó, el botón se queda para que pueda volver a intentar.
        refrescarBoton();
      });
    } else if (esApple() && !yaEstaInstalada()) {
      mostrarInstruccion(t('apple'));
    }

    /* Desde acá en adelante sí corresponde informar: la persona pidió algo. */
    marcarPedido();

    // 2. Y el catálogo
    if (faltaGuardar()) {
      preguntar(true);
      arrancarConsultas();
      mostrarEstado(t('guardando').replace('{pct}', 0), false);
    } else {
      // Ya estaba guardado de antes: se confirma, no se vuelve a bajar nada.
      mostrarEstado(t('listo'), true);
    }

    refrescarBoton();
  }

  function quitarBoton() {
    if (boton && boton.parentNode) boton.parentNode.removeChild(boton);
    boton = null;
  }

  function mostrarInstruccion(texto) {
    var previo = document.getElementById('installHint');
    if (previo && previo.parentNode) previo.parentNode.removeChild(previo);

    var destino = document.getElementById('sidebarFootCopy');
    if (!destino || !destino.parentNode) return;

    var p = document.createElement('p');
    p.id = 'installHint';
    p.className = 'install-hint';
    p.textContent = texto;
    destino.parentNode.insertBefore(p, destino);
    setTimeout(function () {
      if (p.parentNode) p.parentNode.removeChild(p);
    }, 12000);
  }

  /* Android / Chrome de escritorio avisan cuando se puede instalar. El botón
     no depende de este aviso —en iPhone nunca llega— pero si llega, se
     aprovecha para instalar de verdad. */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    promesaInstalar = e;
    /* Este aviso llega tarde, después de cargar la página, y también vuelve a
       llegar cuando alguien desinstala la app. Por eso el botón se rearma acá
       en vez de decidirse una sola vez al arrancar. */
    refrescarBoton();
  });

  window.addEventListener('appinstalled', function () {
    promesaInstalar = null;
    refrescarBoton();
    console.log('[offline] el showroom quedó instalado en el dispositivo.');
  });

  /* --- Arranque ------------------------------------------------------------ */

  document.addEventListener('DOMContentLoaded', function () {
    if (!puedeGuardar) return;

    /* No se pinta ningún cartel de entrada: el guardián contesta enseguida con
       el estado real y ese es el que manda. Adelantarse haría parpadear un
       "0%" que después se corrige solo. */

    /* El botón se decide acá y se vuelve a decidir cada vez que cambia algo
       (llega el aviso de instalación, se instala, se desinstala, termina de
       guardarse). En iPhone este es el único momento en que aparece, porque
       ahí el aviso de instalación no existe. */
    refrescarBoton();
  });
})();
