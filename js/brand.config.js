/* =============================================================================
   CONFIGURACIÓN DE MARCA
   -----------------------------------------------------------------------------
   ESTE ES EL ÚNICO ARCHIVO QUE SE CAMBIA PARA ARMAR EL SHOWROOM DE UN CLIENTE.

   Todo lo que el visitante ve de la marca (el nombre en el menú, el título de la
   pestaña del navegador, el nombre grande de la portada, el pie de página, el
   texto del WhatsApp, la portada de los PDF) sale de acá. No hay que buscar el
   nombre suelto por el código: se cambia una vez en este archivo y viaja a todos
   lados solo.

   PARA ARMAR UN CLIENTE NUEVO:
     1. Cambiá los valores de este archivo.
     2. Poné el logo del cliente en assets/ y apuntá logo.image a ese archivo.
     3. Cambiá el bloque de "vista previa al compartir" que está marcado en
        index.html (son 8 líneas, tienen que estar ahí sí o sí — ver la nota
        al final de este archivo).

   OJO: el catálogo de productos y los ambientes NO se configuran acá. Esos se
   cargan desde el Generador de Productos y el Planificador de Ambientes.
   ========================================================================== */

window.BRAND = {

  /* --- Identidad ---------------------------------------------------------- */

  /* El nombre de la marca del cliente. Aparece en el menú lateral, en la
     portada, en la pestaña del navegador y en los PDF. */
  name: 'LUXA',

  /* La bajada que va debajo del nombre. Normalmente el rubro o el área.
     Dejá '' (vacío) si el cliente no quiere bajada. */
  by: 'TD Lighting Experience',

  /* El logo del cuadradito del menú lateral.
       · mark  → la letra que se muestra si no hay imagen de logo.
       · image → ruta a la imagen del logo (PNG o SVG con fondo transparente).
                 Si la completás, la imagen reemplaza a la letra.
                 Ejemplo: 'assets/logo-cliente.svg' */
  logo: {
    mark:  'L',
    image: ''
  },

  /* El color de acento de la marca: botones, detalles, líneas doradas.
     Se escribe en formato #RRGGBB. */
  accent: '#C9A24B',


  /* --- Sitio -------------------------------------------------------------- */

  site: {
    /* La dirección web pública del showroom, con la barra final. */
    url: 'https://luxa.tdrender.com/',

    /* La imagen que se ve cuando alguien comparte el link por WhatsApp o
       redes. Medida recomendada: 1200 × 630 píxeles. */
    ogImage: 'assets/og-preview.jpg',

    /* Descripción corta del showroom. Es lo que aparece debajo del título
       cuando se comparte el link, y en los resultados de Google. */
    description: {
      es: 'Experiencias de iluminación para espacios modernos — cada luminaria explorada en sus propios términos.',
      en: 'Lighting experiences for modern spaces — every luminaire explored on its own terms.'
    }
  },


  /* --- Contacto ----------------------------------------------------------- */

  contact: {
    /* WhatsApp en formato internacional, sin '+', sin espacios y sin guiones.
       Origen del número actual: +54 9 11 6002-9154 (Argentina · móvil) */
    whatsapp: '5491160029154',

    /* Dirección completa de las redes. Dejá '' para que el ícono no aparezca. */
    facebook:  '',
    instagram: ''
  }

};

/* -----------------------------------------------------------------------------
   NOTA SOBRE LA VISTA PREVIA AL COMPARTIR (las 8 líneas de index.html)

   Cuando pegás el link del showroom en WhatsApp, Instagram o LinkedIn, esas
   aplicaciones NO abren la página: leen unas etiquetas sueltas del archivo
   index.html para armar la tarjetita con imagen y título. Por eso esas líneas
   son las únicas que no pueden salir de este archivo — tienen que estar escritas
   directo en index.html o la vista previa sale vacía.

   Están todas juntas y marcadas con un cartel bien visible al principio de
   index.html, así que es un solo lugar y se cambia en un minuto.
   -------------------------------------------------------------------------- */
