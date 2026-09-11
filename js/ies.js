/* =============================================================================
   IES — lector de archivos fotométricos IES (IESNA LM-63).
   Pieza independiente, compartida: la usan la ficha "Fotometría" de la app y
   la herramienta interna /mapa-de-luz/. No depende de nada más.

   IES.parse(texto)            -> objeto con la fotometría
   IES.intensidad(ies, C, g)   -> candelas en la dirección (C, gamma)
   IES.datos(ies)              -> lúmenes, apertura, pico, % hacia abajo, etc.

   Convención Tipo C: gamma 0° = hacia abajo (nadir), 180° = hacia arriba.
   C 0° = eje largo de la luminaria, creciendo en sentido antihorario visto
   desde arriba.
   ============================================================================= */
(function (global) {
  'use strict';

  function parse(texto) {
    const lineas = texto.replace(/\r/g, '').split('\n');
    const claves = {};
    let i = 0;
    let tilt = 'NONE';

    for (; i < lineas.length; i++) {
      const l = lineas[i].trim();
      const m = l.match(/^\[(\w+)\]\s*(.*)$/);
      if (m) { claves[m[1].toUpperCase()] = m[2].trim(); continue; }
      if (/^TILT\s*=/i.test(l)) { tilt = l.split('=')[1].trim().toUpperCase(); i++; break; }
    }
    if (i >= lineas.length) throw new Error('No parece un archivo IES (falta la línea TILT).');

    const num = lineas.slice(i).join(' ').trim().split(/\s+/).map(Number);
    let p = 0;
    if (tilt === 'INCLUDE') {           // datos de inclinación: se saltean
      p++;                              // geometría
      const n = num[p++];
      p += n * 2;
    }

    const nLamparas   = num[p++];
    const lmPorLampara = num[p++];
    const multiplicador = num[p++];
    const nV = num[p++];
    const nH = num[p++];
    const tipo = num[p++];
    const unidades = num[p++];          // 1 = pies, 2 = metros
    const ancho = num[p++], largo = num[p++], alto = num[p++];
    const factorBalasto = num[p++];
    p++;                                // reservado / factor lámpara-balasto
    const watts = num[p++];

    if (tipo !== 1) throw new Error('Solo se leen fotometrías Tipo C (la de casi todas las luminarias de interior).');

    const V = num.slice(p, p + nV); p += nV;
    const H = num.slice(p, p + nH); p += nH;
    const factor = (multiplicador || 1) * (factorBalasto || 1);
    const cd = [];
    for (let h = 0; h < nH; h++) {
      cd.push(num.slice(p, p + nV).map(v => v * factor));
      p += nV;
    }
    if (cd.length !== nH || cd[nH - 1].length !== nV || cd[nH - 1].some(isNaN)) {
      throw new Error('El archivo IES está incompleto.');
    }

    const aMetros = unidades === 1 ? 0.3048 : 1;
    return {
      claves,
      fabricante: claves.MANUFAC || '',
      codigo: claves.LUMCAT || claves.LUMINAIRE || '',
      nombre: claves.LUMINAIRE || claves.LUMCAT || '',
      nLamparas, lmPorLampara, watts,
      medidas: { ancho: ancho * aMetros, largo: largo * aMetros, alto: alto * aMetros },
      V, H, cd
    };
  }

  // Índice del tramo [k, k+1] que contiene x en un arreglo ascendente.
  function tramo(arr, x) {
    let lo = 0, hi = arr.length - 1;
    if (x <= arr[0]) return 0;
    if (x >= arr[hi]) return hi - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= x) lo = mid; else hi = mid;
    }
    return lo;
  }

  // Lleva un ángulo C cualquiera al rango que cubre el archivo, según su simetría.
  function plegarC(ies, C) {
    const H = ies.H;
    const hMin = H[0], hMax = H[H.length - 1];
    let c = ((C % 360) + 360) % 360;
    if (H.length === 1) return hMin;                       // simétrica en todo el giro
    if (hMin === 0 && hMax === 90) {                       // simetría por cuadrantes
      c = c % 180;
      return c > 90 ? 180 - c : c;
    }
    if (hMin === 0 && hMax === 180) return c > 180 ? 360 - c : c;   // simetría bilateral
    if (hMin === 90 && hMax === 270) {
      if (c < 90) return 180 - c;
      if (c > 270) return 540 - c;
      return c;
    }
    return c;                                              // 0–360 completo
  }

  function intensidad(ies, C, gamma) {
    const V = ies.V, H = ies.H;
    if (gamma < V[0] || gamma > V[V.length - 1]) return 0;
    const c = plegarC(ies, C);
    const j = tramo(V, gamma);
    const tv = V[j + 1] === V[j] ? 0 : (gamma - V[j]) / (V[j + 1] - V[j]);

    if (H.length === 1) {
      const fila = ies.cd[0];
      return fila[j] + (fila[j + 1] - fila[j]) * tv;
    }
    const k = tramo(H, c);
    const th = H[k + 1] === H[k] ? 0 : Math.min(1, Math.max(0, (c - H[k]) / (H[k + 1] - H[k])));
    const a = ies.cd[k], b = ies.cd[k + 1];
    const ia = a[j] + (a[j + 1] - a[j]) * tv;
    const ib = b[j] + (b[j + 1] - b[j]) * tv;
    return ia + (ib - ia) * th;
  }

  // Apertura en un plano (C y C+180): ángulo total donde la intensidad cae al 50% del máximo del plano.
  function aperturaEnPlano(ies, C) {
    let max = 0;
    for (let g = 0; g <= 90; g += 0.25) {
      max = Math.max(max, intensidad(ies, C, g), intensidad(ies, C + 180, g));
    }
    const lado = (cc) => {
      let ultimo = 0;
      for (let g = 0; g <= 90; g += 0.25) if (intensidad(ies, cc, g) >= max / 2) ultimo = g;
      return ultimo;
    };
    return lado(C) + lado(C + 180);
  }

  function datos(ies) {
    const paso = 1, pasoC = 5;
    let flujo = 0, abajo = 0, pico = 0;
    for (let g = 0; g < 180; g += paso) {
      const g1 = g * Math.PI / 180, g2 = (g + paso) * Math.PI / 180;
      const franja = (Math.cos(g1) - Math.cos(g2)) * (pasoC * Math.PI / 180);
      for (let C = 0; C < 360; C += pasoC) {
        const I = (intensidad(ies, C, g) + intensidad(ies, C, g + paso)) / 2;
        const f = I * franja;
        flujo += f;
        if (g + paso <= 90) abajo += f;
        pico = Math.max(pico, intensidad(ies, C, g));
      }
    }
    const declarado = ies.lmPorLampara > 0 ? ies.nLamparas * ies.lmPorLampara : null;
    const lumenes = declarado || flujo;
    const a0 = aperturaEnPlano(ies, 0);
    const a90 = aperturaEnPlano(ies, 90);
    return {
      lumenes,
      lumenesDeclarados: declarado,
      lumenesCalculados: flujo,
      watts: ies.watts || null,
      eficiencia: ies.watts ? lumenes / ies.watts : null,
      pico,
      aperturaC0: a0,
      aperturaC90: a90,
      simetrica: Math.abs(a0 - a90) < 3,
      fraccionAbajo: flujo > 0 ? abajo / flujo : 0
    };
  }

  global.IES = { parse, intensidad, datos };
})(window);
