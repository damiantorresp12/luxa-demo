/* =============================================================================
   INSTALACIÓN Y MODO SIN INTERNET — pwa.js
   -----------------------------------------------------------------------------
   Tres cosas:
     1. Enciende el "guardián" (sw.js), que guarda el showroom en el dispositivo.
     2. Muestra el botón "Instalar" cuando el navegador lo permite.
     3. En iPhone y iPad, donde no existe ese botón, explica cómo hacerlo a mano.

   El nombre y el ícono que se ven al instalar salen de manifest.webmanifest,
   que se genera con tools/aplicar-marca.ps1 a partir de js/brand.config.js.
   ========================================================================== */

(function () {
  'use strict';

  /* El guardián necesita una conexión segura. En el celular de Damian abriendo
     por http://localhost anda igual; en internet, el sitio ya va por https. */
  var puedeGuardar = ('serviceWorker' in navigator) &&
                     (location.protocol === 'https:' || location.hostname === 'localhost');

  /* --- 1. Encender el guardián ------------------------------------------- */
  if (puedeGuardar) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        console.log('[offline] guardián activo', reg.scope);
        /* Preguntarle cómo viene la descarga. Si no se le pregunta, el cartel
           del menú solo aparecería la primera vez que se instala. */
        navigator.serviceWorker.ready.then(function () {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ tipo: 'estado' });
          }
        });
      }).catch(function (e) {
        console.warn('[offline] no se pudo activar:', e && e.message);
      });
    });

    /* El guardián avisa cómo viene la descarga. Se muestra en el pie del menú
       para saber CUÁNDO ya se puede cortar internet sin perder nada — sobre
       todo los videos, que son lo último en bajarse. */
    navigator.serviceWorker.addEventListener('message', function (ev) {
      var m = ev.data || {};
      if (m.tipo === 'offline-progreso') {
        var pct = m.total ? Math.round((m.guardados / m.total) * 100) : 0;
        mostrarEstado(TEXTOS[idioma()].guardando.replace('{pct}', pct), false);
        console.log('[offline] guardando… ' + m.guardados + ' de ' + m.total);
      } else if (m.tipo === 'offline-listo') {
        mostrarEstado(TEXTOS[idioma()].listo, true);
        try { localStorage.setItem('luxa.offline.listo', '1'); } catch (e) {}
        console.log('[offline] listo: ' + m.guardados + ' de ' + m.total +
                    ' archivos guardados' + (m.fallados ? ' (' + m.fallados + ' fallaron)' : '') +
                    '. El showroom ya funciona sin internet.');
      }
    });
  }

  /* --- El cartelito de estado -------------------------------------------- */

  var estadoEl = null;
  /* Una vez que dijo "listo", no vuelve atrás en esta visita. Cuando el
     guardián se reinicia repasa los archivos que ya tenía y volvería a
     contar desde cero, y ver "0%" cuando ya está todo guardado asusta. */
  var yaDijoListo = false;

  function mostrarEstado(texto, completo) {
    if (yaDijoListo && !completo) return;
    if (completo) yaDijoListo = true;
    if (!estadoEl) {
      var destino = document.getElementById('sidebarFootCopy');
      if (!destino || !destino.parentNode) return;
      estadoEl = document.createElement('p');
      estadoEl.id = 'offlineEstado';
      estadoEl.className = 'offline-estado';
      destino.parentNode.insertBefore(estadoEl, destino);
    }
    estadoEl.textContent = texto;
    estadoEl.classList.toggle('is-listo', !!completo);
  }

  /* --- 2. El botón "Instalar" -------------------------------------------- */

  var promesaInstalar = null;   // la guarda el navegador, se usa una sola vez
  var boton = null;

  function yaEstaInstalada() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  function esApple() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           // iPad moderno se hace pasar por Mac; se delata por el tacto.
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function idioma() {
    try {
      var l = localStorage.getItem('luxa.lang');
      return (l === 'en') ? 'en' : 'es';
    } catch (e) { return 'es'; }
  }

  var TEXTOS = {
    es: {
      instalar:  'Instalar app',
      apple:     'Para instalar: tocá el botón Compartir y elegí “Agregar a inicio”.',
      guardando: 'Guardando para uso sin internet · {pct}%',
      listo:     '✓ Listo para usar sin internet'
    },
    en: {
      instalar:  'Install app',
      apple:     'To install: tap the Share button and choose “Add to Home Screen”.',
      guardando: 'Saving for offline use · {pct}%',
      listo:     '✓ Ready for offline use'
    }
  };

  function crearBoton() {
    if (boton || yaEstaInstalada()) return;

    var destino = document.getElementById('sidebarFootCopy');
    if (!destino || !destino.parentNode) return;

    boton = document.createElement('button');
    boton.type = 'button';
    boton.id = 'btnInstalar';
    boton.className = 'install-btn';
    boton.textContent = TEXTOS[idioma()].instalar;
    destino.parentNode.insertBefore(boton, destino);

    boton.addEventListener('click', function () {
      if (promesaInstalar) {
        promesaInstalar.prompt();
        promesaInstalar.userChoice.then(function (r) {
          if (r && r.outcome === 'accepted') ocultarBoton();
          promesaInstalar = null;
        });
      } else if (esApple()) {
        mostrarInstruccion(TEXTOS[idioma()].apple);
      }
    });
  }

  function ocultarBoton() {
    if (boton && boton.parentNode) boton.parentNode.removeChild(boton);
    boton = null;
  }

  function mostrarInstruccion(texto) {
    var previo = document.getElementById('installHint');
    if (previo && previo.parentNode) previo.parentNode.removeChild(previo);

    var p = document.createElement('p');
    p.id = 'installHint';
    p.className = 'install-hint';
    p.textContent = texto;
    if (boton && boton.parentNode) boton.parentNode.insertBefore(p, boton.nextSibling);
    setTimeout(function () {
      if (p.parentNode) p.parentNode.removeChild(p);
    }, 8000);
  }

  /* Android / Chrome de escritorio: el navegador avisa que se puede instalar. */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    promesaInstalar = e;
    crearBoton();
  });

  /* iPhone / iPad: nunca avisa, así que el botón se pone igual y al tocarlo
     se explica el camino manual. */
  document.addEventListener('DOMContentLoaded', function () {
    if (esApple() && !yaEstaInstalada()) crearBoton();

    /* Si en una visita anterior ya se había guardado todo, decirlo de entrada
       en vez de esperar a que el guardián termine de repasar los archivos. */
    var yaGuardado = false;
    try { yaGuardado = localStorage.getItem('luxa.offline.listo') === '1'; } catch (e) {}
    if (yaGuardado && puedeGuardar) mostrarEstado(TEXTOS[idioma()].listo, true);
  });

  window.addEventListener('appinstalled', function () {
    ocultarBoton();
    console.log('[offline] el showroom quedó instalado en el dispositivo.');
  });
})();
