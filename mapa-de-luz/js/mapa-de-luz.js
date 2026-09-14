/* =============================================================================
   TD Light Study · Mapa de luz. Calcula cuánta luz llega a cada punto de la planta a
   partir de la fotometría real (IES) de cada luminaria, y la pinta en colores.

   Luz directa: exacta a partir del IES (ley del cuadrado de la distancia y
   ángulo de incidencia).
   Rebote: estimación pareja para toda la sala con el método clásico de la
   "esfera integradora": lo que rebota la primera vez, repartido entre todas
   las superficies según qué tan claras son. Se rotula como estimado.
   ============================================================================= */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const CELDA = 0.05;          // resolución del mapa: 5 cm
  const PASO_NUMEROS = 0.5;    // un número cada 50 cm
  const BORDE = 0.5;           // franja junto a las paredes que no se cuenta
  const fmt = (n, d = 0) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });

  // Bandas de color por lux (de azul oscuro = poca luz a rojo = mucha).
  const BANDAS = [
    [0, '#0d1846'], [10, '#1c3aa8'], [25, '#1f7bd6'], [50, '#23b3c4'],
    [75, '#2fbf86'], [100, '#58c24a'], [150, '#9fcf3c'], [200, '#d7d839'],
    [300, '#f2c233'], [500, '#f28a2e'], [750, '#e5472d'], [1000, '#b3164f']
  ];
  function banda(lux) {
    let b = BANDAS[0];
    for (const x of BANDAS) if (lux >= x[0]) b = x;
    return b;
  }
  function textoSobre(hex) {
    const n = parseInt(hex.slice(1), 16);
    const l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    return l > 150 ? 'rgba(10,10,12,.85)' : 'rgba(255,255,255,.92)';
  }

  const estado = {
    escena: null, geo: null,
    ies: null, iesNombre: '', datosIes: null, cacheIes: {},
    plano: 0.75, rebote: true, rho: {}, numeros: true, borde: true,
    directa: null, nx: 0, ny: 0, eInd: 0, reboteInfo: null,
    vista: null, vistaMapa: 'planta', fondo: 0,
    modoPorLuz: false        // true = cada luz con su propio IES (el que trae de 3ds Max)
  };

  // ---------------------------------------------------------------- geometría
  function geometria(esc) {
    const m = esc.max, k = m.pulgada;
    const aPlano = (X, Y) => ({ x: (X - m.esquina.X) * k, y: (Y - m.esquina.Y) * k });
    return {
      W: m.cajaAncho * k,
      L: m.cajaLargo * k,
      H: esc.altoTecho,
      luces: m.luces.map((l) => ({ id: l.id, ...aPlano(l.X, l.Y), z: l.Z * k, rot: l.rot || 0, iesRuta: l.iesRuta || null })),
      cam: camara(m, aPlano)
    };
  }

  // Cámara en metros de planta. Si solo tenemos el objetivo y la distancia (lo que muestra
  // Max en la cámara con target), la ubicamos detrás del objetivo, a la altura indicada.
  function camara(m, aPlano) {
    const c = m.camara; if (!c) return null;
    const k = m.pulgada;
    const h = c.alturaM != null ? c.alturaM : c.Z * k;
    let pos;
    if (c.X != null && c.Y != null) pos = { ...aPlano(c.X, c.Y), z: h };
    if (c.objetivo) {
      const t = { ...aPlano(c.objetivo.X, c.objetivo.Y), z: c.objetivo.Z * k };
      if (!pos) {
        const d = c.distanciaObjetivo * k, dz = t.z - h;
        const dh = Math.sqrt(Math.max(0, d * d - dz * dz));
        pos = { x: t.x, y: t.y - dh, z: h };                // mira hacia +Y (el fondo)
      }
      return { ...pos, h, objetivo: t, fov: c.fovHorizontal };
    }
    return { ...pos, h };
  }

  // Proyección de cámara estenopeica (la misma que usa el render).
  function proyector(cam, anchoImg, altoImg) {
    const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
    const cruz = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
    const pto = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z); return { x: a.x / l, y: a.y / l, z: a.z / l }; };
    const f = norm(sub(cam.objetivo, cam));
    const r = norm(cruz(f, { x: 0, y: 0, z: 1 }));
    const u = cruz(r, f);
    const fpx = (anchoImg / 2) / Math.tan((cam.fov * Math.PI / 180) / 2);
    const cx = anchoImg / 2, cy = altoImg / 2;
    return {
      // pixel -> punto de un plano horizontal a la altura h (piso = 0, mesa = 0,74…)
      alPlano(px, py, h) {
        const a = (px - cx) / fpx, b = (py - cy) / fpx;
        const d = { x: f.x + a * r.x - b * u.x, y: f.y + a * r.y - b * u.y, z: f.z + a * r.z - b * u.z };
        if (Math.abs(d.z) < 1e-6) return null;
        const t = (h - cam.z) / d.z;
        if (t <= 0) return null;
        return { x: cam.x + t * d.x, y: cam.y + t * d.y, prof: t * pto(d, f) };
      },
      // pixel -> punto de una pared (plano vertical x = cte o y = cte, ver planoPared)
      alPared(px, py, pl) {
        const a = (px - cx) / fpx, b = (py - cy) / fpx;
        const d = { x: f.x + a * r.x - b * u.x, y: f.y + a * r.y - b * u.y, z: f.z + a * r.z - b * u.z };
        const comp = d[pl.eje];
        if (Math.abs(comp) < 1e-6) return null;
        const t = (pl.valor - cam[pl.eje]) / comp;
        if (t <= 0) return null;
        return { x: cam.x + t * d.x, y: cam.y + t * d.y, z: cam.z + t * d.z, prof: t * pto(d, f) };
      },
      // punto 3D -> pixel
      aPixel(p) {
        const d = sub(p, cam), z = pto(d, f);
        if (z <= 0.05) return null;
        return { x: cx + fpx * pto(d, r) / z, y: cy - fpx * pto(d, u) / z, prof: z, fpx };
      }
    };
  }

  // ------------------------------------------------------------------ cálculo
  // Fotometría de una luz: la suya (modo "según 3ds Max") o la elegida en la lista.
  function iesDe(l) { return (estado.modoPorLuz && l.ies) || estado.ies; }
  function datosDe(l) { return (estado.modoPorLuz && l.datos) || estado.datosIes; }

  function directa(x, y, z) {
    let E = 0;
    for (const l of estado.geo.luces) {
      const dx = x - l.x, dy = y - l.y, dz = l.z - z;
      if (dz <= 0) continue;
      const r2 = dx * dx + dy * dy + dz * dz;
      const r = Math.sqrt(r2);
      const gamma = Math.acos(dz / r) * 180 / Math.PI;
      const C = Math.atan2(dy, dx) * 180 / Math.PI - l.rot;
      E += IES.intensidad(iesDe(l), C, gamma) * (dz / r) / r2;
    }
    return E;
  }

  // Pared del ambiente: plano, normal hacia adentro y cómo ubicar un punto sobre ella
  // (u = metros a lo largo de la pared, z = altura).
  function planoPared(nombre) {
    const { W, L } = estado.geo;
    switch (nombre) {
      case 'izquierda': return { eje: 'x', valor: 0, n: { x: 1, y: 0, z: 0 }, largo: L, punto: (u, z) => ({ x: 0, y: u, z }) };
      case 'derecha':   return { eje: 'x', valor: W, n: { x: -1, y: 0, z: 0 }, largo: L, punto: (u, z) => ({ x: W, y: u, z }) };
      case 'fondo':     return { eje: 'y', valor: L, n: { x: 0, y: -1, z: 0 }, largo: W, punto: (u, z) => ({ x: u, y: L, z }) };
      case 'frente':    return { eje: 'y', valor: 0, n: { x: 0, y: 1, z: 0 }, largo: W, punto: (u, z) => ({ x: u, y: 0, z }) };
      default: return null;
    }
  }

  // Luz directa sobre una superficie con cualquier orientación (normal n): se usa en
  // las paredes. Igual que directa(), pero con el ángulo de incidencia contra la pared.
  function directaN(p, n) {
    let E = 0;
    for (const l of estado.geo.luces) {
      const dx = l.x - p.x, dy = l.y - p.y, dz = l.z - p.z;
      if (dz <= 0) continue;
      const r2 = dx * dx + dy * dy + dz * dz;
      const r = Math.sqrt(r2);
      const cosInc = (dx * n.x + dy * n.y + dz * n.z) / r;
      if (cosInc <= 0) continue;
      const gamma = Math.acos(dz / r) * 180 / Math.PI;
      const C = Math.atan2(-dy, -dx) * 180 / Math.PI - l.rot;
      E += IES.intensidad(iesDe(l), C, gamma) * cosInc / r2;
    }
    return E;
  }

  function calcularGrilla() {
    const { W, L } = estado.geo;
    const nx = Math.round(W / CELDA), ny = Math.round(L / CELDA);
    const cw = W / nx, ch = L / ny;
    const g = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) g[j * nx + i] = directa((i + 0.5) * cw, (j + 0.5) * ch, estado.plano);
    }
    estado.directa = g; estado.nx = nx; estado.ny = ny;
  }

  function calcularRebote() {
    const { W, L, H, luces } = estado.geo;
    const esc = estado.escena, rho = estado.rho;

    // Luz directa que cae sobre el piso (integrada en una grilla de 10 cm).
    const n = 10, nx = Math.round(W * n), ny = Math.round(L * n);
    let phiPiso = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      phiPiso += directa((i + 0.5) / n, (j + 0.5) / n, 0) / (n * n);
    }
    // Cada luz aporta su propio flujo (pueden ser productos distintos)
    let phiTotal = 0, phiArriba = 0;
    for (const l of luces) {
      const d = datosDe(l);
      phiTotal += d.lumenesCalculados;
      phiArriba += d.lumenesCalculados * (1 - d.fraccionAbajo);
    }
    const phiParedes = Math.max(0, phiTotal - phiArriba - phiPiso);

    const aPiso = W * L, aTecho = W * L, aMuros = 2 * (W + L) * H;
    const aVidrio = (esc.vidrios || []).reduce((s, v) => s + (v.hasta - v.desde) * v.alto, 0);
    const aMurosSolidos = Math.max(0, aMuros - aVidrio);
    const rhoMuros = (aMurosSolidos * rho.paredes + aVidrio * rho.vidrio) / aMuros;
    const aTotal = aPiso + aTecho + aMuros;
    const rhoProm = (aPiso * rho.piso + aTecho * rho.techo + aMuros * rhoMuros) / aTotal;

    const phiPrimerRebote = phiPiso * rho.piso + phiArriba * rho.techo + phiParedes * rhoMuros;
    estado.eInd = phiPrimerRebote / (aTotal * (1 - rhoProm));
    estado.reboteInfo = { phiPiso, phiTotal };
  }

  function valor(i, j) {
    return estado.directa[j * estado.nx + i] + (estado.rebote ? estado.eInd : 0);
  }

  function estadisticas() {
    const { W, L } = estado.geo, nx = estado.nx, ny = estado.ny, cw = W / nx, ch = L / ny;
    const m = estado.borde ? BORDE : 0;
    let suma = 0, n = 0, min = Infinity, max = 0;
    for (let j = 0; j < ny; j++) {
      const y = (j + 0.5) * ch;
      if (y < m || y > L - m) continue;
      for (let i = 0; i < nx; i++) {
        const x = (i + 0.5) * cw;
        if (x < m || x > W - m) continue;
        const e = valor(i, j);
        suma += e; n++;
        if (e < min) min = e;
        if (e > max) max = e;
      }
    }
    const prom = suma / n;
    return { prom, min, max, uni: prom > 0 ? min / prom : 0 };
  }

  // Números de la planta entera a una altura cualquiera (piso = 0, trabajo = 0,75),
  // sin contar la franja junto a las paredes. Independiente de lo que se ve en pantalla.
  function statsPlanta(h) {
    const { W, L } = estado.geo, m = BORDE, e = estado.rebote ? estado.eInd : 0;
    let suma = 0, n = 0, min = Infinity, max = 0;
    for (let y = m + CELDA / 2; y < L - m; y += CELDA) {
      for (let x = m + CELDA / 2; x < W - m; x += CELDA) {
        const v = directa(x, y, h) + e;
        suma += v; n++;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const prom = n ? suma / n : 0;
    return { prom, min: n ? min : 0, max, uni: prom ? min / prom : 0 };
  }

  // ------------------------------------------------------------------- dibujo
  function dibujarMapa() {
    const { W, L, luces, cam } = estado.geo;
    const canvas = $('#mapa');
    const wrap = $('#mapa-wrap').parentElement;
    const margen = 0.75;                                     // aire alrededor, en metros
    const dispW = Math.max(260, wrap.clientWidth - 8);
    const dispH = Math.max(420, window.innerHeight - 190);
    const s = Math.max(30, Math.min(110, Math.min(dispW / (W + 2 * margen), dispH / (L + 2 * margen))));
    const cssW = Math.round((W + 2 * margen) * s), cssH = Math.round((L + 2 * margen) * s);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const X = (x) => (margen + x) * s;
    const Y = (y) => (margen + L - y) * s;                    // el fondo arriba, como la vista Top de Max
    estado.vista = { s, margen, X, Y };

    // Mapa de colores
    const nx = estado.nx, ny = estado.ny, cw = W / nx, ch = L / ny;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      ctx.fillStyle = banda(valor(i, j))[1];
      const x0 = X(i * cw), y0 = Y((j + 1) * ch);
      ctx.fillRect(x0, y0, Math.ceil(cw * s) + 0.5, Math.ceil(ch * s) + 0.5);
    }

    // Franja que no se cuenta
    if (estado.borde) {
      ctx.fillStyle = 'rgba(10,10,12,.38)';
      ctx.beginPath();
      ctx.rect(X(0), Y(L), W * s, L * s);
      ctx.rect(X(W - BORDE), Y(L - BORDE), -(W - 2 * BORDE) * s, (L - 2 * BORDE) * s);
      ctx.fill('evenodd');
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
      ctx.strokeRect(X(BORDE), Y(L - BORDE), (W - 2 * BORDE) * s, (L - 2 * BORDE) * s);
      ctx.setLineDash([]);
    }

    // Números
    if (estado.numeros) {
      ctx.font = `${s >= 70 ? 11 : 10}px Segoe UI, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const e = estado.rebote ? estado.eInd : 0;
      for (let y = PASO_NUMEROS / 2; y < L; y += PASO_NUMEROS) {
        for (let x = PASO_NUMEROS / 2; x < W; x += PASO_NUMEROS) {
          // no tapar la marca ni el nombre de una luminaria
          if (luces.some((l) => Math.abs(l.y - y) < 0.2 && x > l.x - 0.2 && x < l.x + 0.6)) continue;
          const lux = directa(x, y, estado.plano) + e;
          ctx.fillStyle = textoSobre(banda(lux)[1]);
          ctx.fillText(fmt(lux), X(x), Y(y));
        }
      }
    }

    // Paredes
    ctx.strokeStyle = '#ececec'; ctx.lineWidth = 2;
    ctx.strokeRect(X(0), Y(L), W * s, L * s);

    // Vidrios
    for (const v of estado.escena.vidrios || []) {
      const xw = v.pared === 'izquierda' ? 0 : W;
      ctx.strokeStyle = '#7fb4e6'; ctx.lineWidth = 5;
      if (v.pared === 'derecha') ctx.setLineDash([10, 5]);
      ctx.beginPath(); ctx.moveTo(X(xw), Y(v.desde)); ctx.lineTo(X(xw), Y(v.hasta)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.save();
      ctx.fillStyle = '#7fb4e6'; ctx.font = '11px Segoe UI, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.translate(X(xw) + (v.pared === 'izquierda' ? -14 : 14), Y((v.desde + v.hasta) / 2));
      ctx.rotate(v.pared === 'izquierda' ? -Math.PI / 2 : Math.PI / 2);
      ctx.fillText(v.nombre, 0, 0);
      ctx.restore();
    }

    // Luminarias
    const lado = Math.max(7, 0.1 * s);
    for (const l of luces) {
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#0a0a0c'; ctx.lineWidth = 1.5;
      ctx.fillRect(X(l.x) - lado / 2, Y(l.y) - lado / 2, lado, lado);
      ctx.strokeRect(X(l.x) - lado / 2, Y(l.y) - lado / 2, lado, lado);
      ctx.font = '600 11px Segoe UI, system-ui, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,10,12,.8)';
      ctx.strokeText(l.id, X(l.x) + lado / 2 + 5, Y(l.y));
      ctx.fillStyle = '#ffffff';
      ctx.fillText(l.id, X(l.x) + lado / 2 + 5, Y(l.y));
    }

    // Cámara del render
    if (cam) {
      const cx = X(cam.x), cy = Y(cam.y), t = 9;
      ctx.fillStyle = '#c9a35a';
      ctx.beginPath(); ctx.moveTo(cx, cy - t); ctx.lineTo(cx - t * 0.75, cy + t * 0.6); ctx.lineTo(cx + t * 0.75, cy + t * 0.6); ctx.closePath(); ctx.fill();
      ctx.font = '11px Segoe UI, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,10,12,.8)';
      const txt = 'cámara' + (cam.h ? ` · ${fmt(cam.h, 1)} m` : '');
      ctx.strokeText(txt, cx + 12, cy); ctx.fillText(txt, cx + 12, cy);
    }

    // Rótulos y escala
    ctx.fillStyle = '#9a9aa3'; ctx.font = '11px Segoe UI, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('fondo', X(W / 2), Y(L) - 6);
    ctx.textBaseline = 'top';
    ctx.fillText(`${fmt(W, 2)} m`, X(W / 2), Y(0) + 6);
    ctx.strokeStyle = '#9a9aa3'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(0), Y(0) + 26); ctx.lineTo(X(1), Y(0) + 26); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillText('1 m', X(1) + 6, Y(0) + 20);
  }

  function dibujarLeyenda() {
    const barra = BANDAS.map((b) => `<i style="background:${b[1]}"></i>`).join('');
    const nums = BANDAS.map((b, k) => `<span>${k === BANDAS.length - 1 ? b[0] + '+' : b[0]}</span>`).join('');
    $('#leyenda').innerHTML = `<div class="leyenda-titulo">lux (lx)</div><div class="leyenda-barra">${barra}</div><div class="leyenda-nums">${nums}</div>`;
  }

  function dibujarPolar() {
    const ies = estado.ies, d = estado.datosIes;
    const canvas = $('#polar'), dpr = window.devicePixelRatio || 1, T = 300;
    canvas.width = T * dpr; canvas.height = T * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, T, T);
    const cx = T / 2, cy = T / 2, R = 128;
    const aKlm = 1000 / d.lumenesCalculados;

    let max = 0;
    for (let g = 0; g <= 180; g++) for (const C of [0, 90, 180, 270]) max = Math.max(max, IES.intensidad(ies, C, g) * aKlm);
    const pasos = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000];
    const anillo = pasos.find((p) => p * 4 >= max) || Math.ceil(max / 4);
    const tope = anillo * 4;

    ctx.strokeStyle = '#2a2a33'; ctx.lineWidth = 1;
    ctx.fillStyle = '#6a6a73'; ctx.font = '10px Segoe UI, system-ui, sans-serif';
    for (let k = 1; k <= 4; k++) {
      ctx.beginPath(); ctx.arc(cx, cy, R * k / 4, 0, Math.PI * 2); ctx.stroke();
      // Escala en la mitad de arriba: en luminarias que alumbran hacia abajo queda libre.
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(fmt(anillo * k), cx + 4, cy - R * k / 4 + 7);
    }
    for (let a = 0; a < 180; a += 30) {
      const r = a * Math.PI / 180;
      ctx.beginPath(); ctx.moveTo(cx - R * Math.sin(r), cy - R * Math.cos(r)); ctx.lineTo(cx + R * Math.sin(r), cy + R * Math.cos(r)); ctx.stroke();
    }
    ctx.textAlign = 'center';
    for (const a of [0, 30, 60, 90, 120, 150, 180]) {
      const r = a * Math.PI / 180;
      ctx.fillText(a + '°', cx + (R + 12) * Math.sin(r), cy + (R + 12) * Math.cos(r));
    }

    const curva = (C, color, rayado) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(rayado ? [5, 4] : []);
      ctx.beginPath();
      for (let g = -180; g <= 180; g += 1) {
        const plano = g < 0 ? C + 180 : C;
        const I = IES.intensidad(ies, plano, Math.abs(g)) * aKlm;
        const r = (I / tope) * R, ang = g * Math.PI / 180;
        const px = cx + r * Math.sin(ang), py = cy + r * Math.cos(ang);
        if (g === -180) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke(); ctx.setLineDash([]);
    };
    curva(90, '#7fb4e6', true);
    curva(0, '#c9a35a', false);
  }

  function mostrarFicha() {
    const ies = estado.ies, d = estado.datosIes;
    $('#f-nombre').textContent = ies.codigo || estado.iesNombre;
    $('#f-fab').textContent = [ies.fabricante && `Fabricante: ${ies.fabricante}`, ies.claves.TESTDATE && `Medido: ${ies.claves.TESTDATE}`].filter(Boolean).join(' · ');
    const apertura = d.simetrica ? `${fmt(d.aperturaC0)}°` : `${fmt(d.aperturaC0)}° × ${fmt(d.aperturaC90)}°`;
    const filas = [
      ['Lúmenes', `${fmt(d.lumenes)} lm`],
      ['Potencia', d.watts ? `${fmt(d.watts)} W` : '—'],
      ['Eficiencia', d.eficiencia ? `${fmt(d.eficiencia)} lm/W` : '—'],
      ['Apertura', apertura],
      ['Intensidad máxima', `${fmt(d.pico)} cd`],
      ['Luz hacia abajo', `${fmt(d.fraccionAbajo * 100)} %`],
      ['Chequeo: la curva suma', `${fmt(d.lumenesCalculados)} lm`]
    ];
    $('#f-datos').innerHTML = filas.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  }

  function mostrarResultados() {
    const st = estadisticas();
    $('#k-prom').textContent = fmt(st.prom);
    $('#k-min').textContent = fmt(st.min);
    $('#k-max').textContent = fmt(st.max);
    $('#k-uni').textContent = fmt(st.uni, 2);

    const ref = estado.escena.referencia;
    if (ref && estado.plano > 0) {
      const pct = st.prom / ref.lux;
      const okLux = st.prom >= ref.lux, okUni = st.uni >= ref.uniformidad;
      $('#referencia').innerHTML =
        `Referencia · ${ref.nombre} (${ref.fuente}): <b>${fmt(ref.lux)} lx</b> promedio y uniformidad <b>${fmt(ref.uniformidad, 2)}</b>.` +
        `<div class="barra"><i style="width:${Math.min(100, pct * 100)}%"></i></div>` +
        `<span class="${okLux ? 'bien' : 'mal'}">Llega al ${fmt(pct * 100)} % de la luz recomendada</span> · ` +
        `<span class="${okUni ? 'bien' : 'mal'}">uniformidad ${okUni ? 'suficiente' : 'baja'}</span>.`;
    } else {
      $('#referencia').innerHTML = ref ? `La referencia (${ref.nombre.toLowerCase()}, ${fmt(ref.lux)} lx) se mide a 0,75 m, la altura del escritorio.` : '';
    }

    const r = estado.reboteInfo;
    $('#rebote-info').innerHTML = estado.rebote
      ? `Suma <b>${fmt(estado.eInd)} lx</b> parejo en toda la sala. Del total de ${fmt(r.phiTotal)} lm, ${fmt(r.phiPiso)} lm caen directo al piso.`
      : 'Solo luz directa.';
  }

  // ------------------------------------------------------ mapa sobre el render
  // Cada pixel del piso del render se lleva a su punto real del piso (con la cámara
  // de Max) y se pinta con los lux de ese punto. La máscara dice qué pixeles son piso.
  const cacheImg = {};
  function cargarImagen(src) {
    if (!cacheImg[src]) cacheImg[src] = new Promise((ok) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => ok(null);
      im.src = src;
    });
    return cacheImg[src];
  }
  function listaRenders() {
    return ((estado.escena.imagenes || {}).render || [])
      .map((r) => (typeof r === 'string' ? { archivo: r, nombre: r } : r));
  }

  // Cada render trae sus superficies: el piso ({ altura: 0 }) y las paredes
  // ({ pared: 'izquierda' | 'derecha' | 'fondo' | 'frente' }), cada una con su máscara.
  // Los muebles van con IA sobre el render vacío, así que no se calcula sobre ellos.
  function superficiesDe(render) {
    if (render && render.superficies) return render.superficies;
    const piso = (estado.escena.imagenes || {}).piso;
    return piso ? [{ nombre: 'Piso', mascara: piso, altura: 0 }] : [];
  }

  async function leerMascara(nombre, Wi, Hi) {
    const im = await cargarImagen('escenas/' + nombre);
    if (!im) return null;
    const c = document.createElement('canvas'); c.width = Wi; c.height = Hi;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0, Wi, Hi);
    return x.getImageData(0, 0, Wi, Hi).data;
  }

  // Mask ID de Corona: un color plano por objeto. El color de la superficie se toma solo,
  // del pixel donde cae el centro del ambiente (a la altura de la superficie), y se marcan
  // todos los pixeles de ese color (con tolerancia para los bordes suavizados).
  async function leerMaskId(s, Wi, Hi, P) {
    const im = await cargarImagen('escenas/' + s.maskId);
    if (!im) return null;
    const c = document.createElement('canvas'); c.width = Wi; c.height = Hi;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = false;
    x.drawImage(im, 0, 0, Wi, Hi);
    const d = x.getImageData(0, 0, Wi, Hi).data;
    const { W, L } = estado.geo;
    // Piso: el centro del ambiente. Pared: su centro a 0,4 m de altura (debajo de
    // cualquier ventana); se puede cambiar con muestraU (0-1 a lo largo) y muestraZ.
    const pl = s.pared ? planoPared(s.pared) : null;
    const muestra = pl
      ? pl.punto(pl.largo * (s.muestraU != null ? s.muestraU : 0.5), s.muestraZ != null ? s.muestraZ : 0.4)
      : { x: W / 2, y: L / 2, z: s.altura || 0 };
    const p = P.aPixel(muestra);
    if (!p || p.x < 0 || p.y < 0 || p.x >= Wi || p.y >= Hi) return null;
    const i0 = ((p.y | 0) * Wi + (p.x | 0)) * 4;
    const r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2], tol = 24;
    const mk = new Uint8ClampedArray(Wi * Hi * 4);
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) <= tol) mk[i] = 255;
    }
    return mk;
  }

  // opciones.archivo: dibujar sobre ese render en vez del elegido en la lista (lo usa
  // "Guardar para la app" para generar un mapa por terminación).
  async function dibujarSobreRender(opciones) {
    const cam = estado.geo.cam, nota = $('#compuesto-nota');
    if (!cam || !cam.objetivo || !cam.fov) { nota.textContent = 'Faltan los datos de la cámara (objetivo y lente).'; return; }

    const lista = listaRenders();
    let forzado = opciones && opciones.archivo && lista.find((r) => r.archivo === opciones.archivo);
    // Un fondo que no está en la lista (ej. el render con artefactos negros, que solo usa la
    // app): se dibuja con las superficies del primero, porque es la misma cámara y el mismo Mask ID.
    if (opciones && opciones.archivo && !forzado && lista[0]) forzado = { ...lista[0], archivo: opciones.archivo };
    const orden = forzado ? [forzado] : (lista[estado.fondo] ? [lista[estado.fondo], ...lista] : lista);
    let render = null, base = null;
    for (const r of orden) { base = await cargarImagen('escenas/' + r.archivo); if (base) { render = r; break; } }
    const Wi = base ? base.naturalWidth : 2000;
    const Hi = base ? base.naturalHeight : 1333;

    const cv = $('#compuesto');
    cv.width = Wi; cv.height = Hi;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (base) ctx.drawImage(base, 0, 0, Wi, Hi);
    else { ctx.fillStyle = '#26262b'; ctx.fillRect(0, 0, Wi, Hi); }
    const img = ctx.getImageData(0, 0, Wi, Hi), px = img.data;

    // Superficies con su máscara leída. Sin ninguna máscara, se pinta la caja del piso.
    const P = proyector(cam, Wi, Hi);
    const pedidas = superficiesDe(render);
    const sup = [];
    const faltan = [];
    for (const s of pedidas) {
      const mk = s.maskId ? await leerMaskId(s, Wi, Hi, P) : await leerMascara(s.mascara, Wi, Hi);
      if (mk) sup.push({ ...s, mk, pl: s.pared ? planoPared(s.pared) : null }); else faltan.push(s);
    }
    const sinMascaras = pedidas.length === 0;
    if (sinMascaras) sup.push({ nombre: 'Piso', altura: 0, mk: null });

    const { W, L } = estado.geo;
    const e = estado.rebote ? estado.eInd : 0;
    const colores = BANDAS.map((b) => [1, 3, 5].map((k) => parseInt(b[1].slice(k, k + 2), 16)));
    const indice = (lux) => { let k = 0; for (let i = 0; i < BANDAS.length; i++) if (lux >= BANDAS[i][0]) k = i; return k; };
    const B = 2;                                            // se calcula de a bloques de 2×2 pixeles
    const dentro = (q) => q && q.x >= 0 && q.x <= W && q.y >= 0 && q.y <= L;

    for (let by = 0; by < Hi; by += B) {
      for (let bx = 0; bx < Wi; bx += B) {
        const i0 = ((by + (B >> 1)) * Wi + bx + (B >> 1)) * 4;
        let col = null, cual = null;
        for (const s of sup) {
          if (s.mk && s.mk[i0] <= 127) continue;
          let lux;
          if (s.pl) {
            const q = P.alPared(bx + B / 2, by + B / 2, s.pl);
            if (!q || q.z < 0 || q.z > estado.geo.H) continue;
            lux = directaN(q, s.pl.n) + e;
          } else {
            const q = P.alPlano(bx + B / 2, by + B / 2, s.altura);
            if (!q || (!s.mk && !dentro(q))) continue;
            lux = directa(q.x, q.y, s.altura) + e;
          }
          col = colores[indice(lux)];
          cual = s;
          break;
        }
        for (let y = by; y < Math.min(by + B, Hi); y++) {
          for (let x = bx; x < Math.min(bx + B, Wi); x++) {
            const i = (y * Wi + x) * 4;
            const gris = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            if (col && (!cual.mk || cual.mk[i] > 127)) {
              const a = 0.72, g = gris * 0.8 * (1 - a);
              px[i] = g + col[0] * a; px[i + 1] = g + col[1] * a; px[i + 2] = g + col[2] * a;
            } else {
              px[i] = px[i + 1] = px[i + 2] = gris * 0.5;
            }
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    // Lux sobre cada superficie (cada 1 m en el piso, más seguido en una mesa), más chicos cuanto más lejos
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const ocupados = [];                                    // para no encimar números
    const libre = (x, y, w, h) => !ocupados.some((o) => Math.abs(o.x - x) < (o.w + w) / 2 + 6 && Math.abs(o.y - y) < (o.h + h) / 2 + 4);
    // Dónde se escriben los lux: en el piso cada 1 m; en las paredes cada 1 m a lo largo,
    // a 1,0 y 2,0 m de altura.
    const puntosDe = (s) => {
      const pts = [];
      if (s.pl) {
        for (let u = 0.5; u < s.pl.largo; u += 1) {
          for (const z of [1.0, 2.0]) { const p3 = s.pl.punto(u, z); pts.push({ p3, lux: () => directaN(p3, s.pl.n) + e }); }
        }
      } else {
        const paso = s.paso || 1;
        for (let y = paso / 2; y < L; y += paso) {
          for (let x = paso / 2; x < W; x += paso) pts.push({ p3: { x, y, z: s.altura }, lux: () => directa(x, y, s.altura) + e });
        }
      }
      return pts;
    };
    for (const s of sup) {
      for (const pt of puntosDe(s)) {
        {
          const p = P.aPixel(pt.p3);
          if (!p || p.x < 0 || p.y < 0 || p.x >= Wi || p.y >= Hi) continue;
          if (s.mk && s.mk[((p.y | 0) * Wi + (p.x | 0)) * 4] < 128) continue;
          const t = Math.min(56, p.fpx * 0.09 / p.prof);
          if (t < 15) continue;                            // más chico no se lee (la pared del fondo da ~17)
          const txt = fmt(pt.lux());
          ctx.font = `600 ${Math.round(t)}px Segoe UI, system-ui, sans-serif`;
          const ancho = ctx.measureText(txt).width;
          if (!libre(p.x, p.y, ancho, t)) continue;
          ocupados.push({ x: p.x, y: p.y, w: ancho, h: t });
          ctx.lineWidth = Math.max(3, t / 5); ctx.strokeStyle = 'rgba(0,0,0,.65)';
          ctx.strokeText(txt, p.x, p.y);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(txt, p.x, p.y);
        }
      }
    }

    // Números de cada superficie visible: se muestrea la planta cada 5 cm a la altura de la
    // superficie y se cuentan solo los puntos que caen sobre su máscara en la imagen.
    // (en las paredes, la parte que se ve en el render: la máscara deja afuera ventanas y marcos)
    estado.statsSuperficies = sup.filter((s) => s.mk).map((s) => {
      let suma = 0, n = 0, min = Infinity, max = 0;
      const sumar = (p3, calc) => {
        const p = P.aPixel(p3);
        if (!p || p.x < 0 || p.y < 0 || p.x >= Wi || p.y >= Hi) return;
        if (s.mk[((p.y | 0) * Wi + (p.x | 0)) * 4] < 128) return;
        const lux = calc();
        suma += lux; n++;
        if (lux < min) min = lux;
        if (lux > max) max = lux;
      };
      if (s.pl) {
        for (let u = 0.025; u < s.pl.largo; u += 0.05) {
          for (let z = 0.025; z < estado.geo.H; z += 0.05) { const p3 = s.pl.punto(u, z); sumar(p3, () => directaN(p3, s.pl.n) + e); }
        }
      } else {
        for (let y = 0.025; y < L; y += 0.05) {
          for (let x = 0.025; x < W; x += 0.05) sumar({ x, y, z: s.altura }, () => directa(x, y, s.altura) + e);
        }
      }
      const prom = n ? suma / n : 0;
      return { nombre: s.nombre, altura: s.altura, pared: s.pared || null, prom, min: n ? min : 0, max, uni: prom ? min / prom : 0, area: n * 0.0025 };
    });
    estado.renderActual = render;
    // "Guardar para la app" solo sirve con luxa-server en la compu; en la versión publicada no se muestra
    const enLaCompu = ['localhost', '127.0.0.1'].includes(location.hostname);
    $('#btn-guardar-app').hidden = !(render && render.paraApp && enLaCompu);

    $('#compuesto-base').src = base ? base.src : cv.toDataURL('image/jpeg', 0.6);
    if (!opciones) {
      const muebles = render && render.conMuebles;
      const bMuebles = $('#switch-app [data-capa="muebles"]');
      bMuebles.hidden = !muebles;
      if (muebles) $('#compuesto-muebles').src = 'escenas/' + muebles;
      else if (bMuebles.classList.contains('activo')) $('#switch-app [data-capa="mapa"]').click();
    }
    const partes = [base ? `Render: ${render.archivo}` : 'Sin render: guardalo en <code>mapa-de-luz/escenas/</code>'];
    if (sinMascaras) partes.push('sin máscara: se pinta la caja del piso');
    for (const st of estado.statsSuperficies) {
      const donde = st.pared ? '' : ` a ${fmt(st.altura, 2)} m`;
      partes.push(`<b>${st.nombre}</b>${donde}: ${fmt(st.prom)} lx promedio (mín ${fmt(st.min)} · máx ${fmt(st.max)})`);
    }
    for (const s of faltan) partes.push(`<span class="falta">falta la máscara «${s.maskId || s.mascara}» (${s.nombre.toLowerCase()})</span>`);
    nota.innerHTML = partes.join(' · ');
  }

  let pendienteRender = null;
  function programarSobreRender() {
    if (estado.vistaMapa !== 'render') return;
    clearTimeout(pendienteRender);
    pendienteRender = setTimeout(() => { dibujarSobreRender().catch((e) => console.error(e)); }, 120);
  }

  function redibujar() {
    dibujarMapa();
    mostrarResultados();
    programarSobreRender();
  }

  // --------------------------------------------------------------- IES y UI
  async function cargarIes(nombre) {
    if (!estado.cacheIes[nombre]) {
      const url = estado.escena.iesCarpeta + encodeURIComponent(nombre);
      const r = await fetch(url);
      if (!r.ok) throw new Error(`No se pudo abrir el archivo IES (${r.status}): ${nombre}`);
      const ies = IES.parse(await r.text());
      estado.cacheIes[nombre] = { ies, datos: IES.datos(ies) };
    }
    const c = estado.cacheIes[nombre];
    estado.ies = c.ies; estado.datosIes = c.datos; estado.iesNombre = nombre;
  }

  // Carga el IES de cada luz que lo trae de 3ds Max. Si hay alguno, se activa el modo
  // "según 3ds Max" y la ficha muestra el producto que más se repite.
  async function cargarIesPorLuz() {
    const luces = estado.geo.luces.filter((l) => l.iesRuta);
    if (!luces.length) return null;
    const cache = {};
    for (const l of luces) {
      if (!cache[l.iesRuta]) {
        const url = l.iesRuta.split('/').map(encodeURIComponent).join('/');
        const r = await fetch(url);
        if (!r.ok) throw new Error(`No se pudo abrir el IES de ${l.id} (${r.status}): ${l.iesRuta}`);
        const ies = IES.parse(await r.text());
        cache[l.iesRuta] = { ies, datos: IES.datos(ies), n: 0 };
      }
      const c = cache[l.iesRuta];
      l.ies = c.ies; l.datos = c.datos; c.n++;
    }
    const grupos = Object.values(cache).sort((a, b) => b.n - a.n);
    estado.modoPorLuz = true;
    estado.iesPorLuz = grupos;
    return grupos;
  }

  function usarProductoPrincipal() {
    const g = estado.iesPorLuz && estado.iesPorLuz[0];
    if (!g) return;
    estado.ies = g.ies; estado.datosIes = g.datos; estado.iesNombre = g.ies.nombre;
  }

  function composicion() {
    if (!estado.modoPorLuz || !estado.iesPorLuz) return null;
    const sinIes = estado.geo.luces.filter((l) => !l.ies).length;
    return estado.iesPorLuz.map((g) => `${g.n} × ${g.ies.nombre}`).join(' + ') + (sinIes ? ` + ${sinIes} sin IES` : '');
  }

  function recalcularTodo() {
    calcularGrilla();
    calcularRebote();
    redibujar();
  }

  function etiquetaIes(nombre) {
    const m = nombre.match(/2\.2 (\w) ([\d°x]+) \[(\d+K)/);
    const tipo = { S: 'Haz cerrado', F: 'Haz medio', L: 'Haz abierto', W: 'Haz ovalado' };
    return m ? `${m[2]} · ${m[3]} — ${tipo[m[1]] || m[1]}` : nombre;
  }

  function armarControles() {
    const esc = estado.escena;
    const sel = $('#sel-ies');
    const conMax = !!estado.iesPorLuz;
    sel.innerHTML =
      (conMax ? `<option value="__max__" selected>Según 3ds Max (cada luz con su IES)</option>` : '') +
      esc.iesOpciones.map((n) => `<option value="${n}"${!conMax && n === esc.iesElegido ? ' selected' : ''}>Todas: ${etiquetaIes(n)}</option>`).join('');
    sel.addEventListener('change', async () => {
      try {
        if (sel.value === '__max__') { estado.modoPorLuz = true; usarProductoPrincipal(); }
        else { estado.modoPorLuz = false; await cargarIes(sel.value); }
        mostrarFicha(); dibujarPolar(); recalcularTodo();
      } catch (e) { alert(e.message); }
    });

    $('#seg-plano').addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      $('#seg-plano').querySelectorAll('button').forEach((x) => x.classList.toggle('activo', x === b));
      estado.plano = parseFloat(b.dataset.plano);
      calcularGrilla(); redibujar();
    });

    for (const k of ['techo', 'paredes', 'piso']) {
      const inp = $('#r-' + k), out = $('#v-' + k);
      inp.value = estado.rho[k]; out.textContent = fmt(estado.rho[k], 2);
      inp.addEventListener('input', () => {
        estado.rho[k] = parseFloat(inp.value); out.textContent = fmt(estado.rho[k], 2);
        calcularRebote(); redibujar();
      });
    }
    $('#chk-rebote').addEventListener('change', (e) => { estado.rebote = e.target.checked; redibujar(); });
    $('#chk-numeros').addEventListener('change', (e) => { estado.numeros = e.target.checked; dibujarMapa(); });
    $('#chk-borde').addEventListener('change', (e) => { estado.borde = e.target.checked; redibujar(); });

    // Planta / Sobre el render
    $('#seg-vista').addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      $('#seg-vista').querySelectorAll('button').forEach((x) => x.classList.toggle('activo', x === b));
      estado.vistaMapa = b.dataset.vista;
      $('#mapa-wrap').hidden = estado.vistaMapa !== 'planta';
      $('#render-wrap').hidden = estado.vistaMapa !== 'render';
      if (estado.vistaMapa === 'render') dibujarSobreRender().catch((e) => console.error(e));
      else dibujarMapa();
    });

    // Con muebles / Sin muebles / Mapa de luz, con fundido. El mapa siempre se calcula
    // sobre el render vacío: los muebles (IA) son solo para ver cómo queda.
    $('#switch-app').addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      $('#switch-app').querySelectorAll('button').forEach((x) => x.classList.toggle('activo', x === b));
      $('.escenario').classList.toggle('ver-render', b.dataset.capa === 'vacio');
      $('.escenario').classList.toggle('ver-muebles', b.dataset.capa === 'muebles');
    });

    const selFondo = $('#sel-fondo');
    selFondo.innerHTML = listaRenders().map((r, i) => `<option value="${i}">${r.nombre}</option>`).join('');
    // Con un solo render no hay nada que elegir
    selFondo.closest('label').hidden = listaRenders().length < 2;
    selFondo.addEventListener('change', () => {
      estado.fondo = parseInt(selFondo.value, 10);
      dibujarSobreRender().catch((e) => console.error(e));
    });

    // Guarda en la carpeta de la escena de la app el mapa de CADA óptica, y anota
    // la escena con los números de cada una en data/mapas-de-luz.json, que es lo que
    // lee la app. Ese índice no lo toca el Space Planner, así que publicar escenas
    // no borra el mapa. Necesita luxa-server, el servidor que sabe guardar archivos.
    $('#btn-guardar-app').addEventListener('click', async () => {
      const r = estado.renderActual, cfg = r && r.paraApp, btn = $('#btn-guardar-app');
      if (!cfg) return;
      if (cfg.propuesta) { await guardarPropuesta(cfg, btn); return; }
      if (estado.iesPorLuz && estado.iesPorLuz.length > 1) {
        alert('Esta escena mezcla productos (cada luz con su IES). Para guardarla, la escena tiene que definir una "propuesta" en paraApp. No se guardó nada.');
        return;
      }
      clearTimeout(pendienteRender);
      btn.disabled = true;
      const previa = estado.iesNombre;
      const reemplazadas = [];
      const subir = async (nombre, blob) => {
        const res = await fetch('/__upload?reemplazar=1&path=' + encodeURIComponent(cfg.carpeta + nombre), { method: 'POST', body: blob });
        if (res.status === 404) throw new Error('Este servidor no guarda archivos. Abrí la herramienta desde luxa-server (http://localhost:8080/mapa-de-luz/).');
        const j = await res.json();
        if (!j.ok) throw new Error(j.error || 'no se pudo guardar');
        reemplazadas.push(cfg.carpeta + nombre);
        return j;
      };
      try {
        // La foto de la escena en la app sale del render de la herramienta: así, al
        // actualizar un render, este mismo botón deja la app al día.
        if (cfg.fotoEscena) {
          btn.textContent = 'Guardando la foto de la escena…';
          const foto = await cargarImagen('escenas/' + cfg.fotoEscena);
          if (!foto) throw new Error('No encuentro el render ' + cfg.fotoEscena);
          await subir(`${cfg.base}.jpeg`, await imagenParaApp(foto));
        }
        const opticas = [];
        for (let i = 0; i < cfg.opticas.length; i++) {
          const o = cfg.opticas[i];
          btn.textContent = `Guardando ${i + 1} de ${cfg.opticas.length}…`;
          await cargarIes(o.ies);
          calcularGrilla();
          calcularRebote();
          await dibujarSobreRender();
          const d = estado.datosIes;
          const sup = estado.statsSuperficies[0];
          if (!sup) throw new Error('Falta la máscara de la superficie: no hay imagen para guardar.');
          // "planta": números de toda la superficie en planta (el piso completo);
          // si no, los de lo que se ve de la superficie en el render (la mesa).
          const st = cfg.estadisticas === 'planta' ? statsPlanta(sup.altura) : sup;
          const trabajo = cfg.trabajo != null ? statsPlanta(cfg.trabajo) : null;
          const imagen = `${cfg.base} mapa ${cfg.sufijo ? cfg.sufijo + ' ' : ''}${o.id}.jpeg`;
          await subir(imagen, await imagenParaApp());
          opticas.push({
            id: o.id,
            nombre: o.nombre,
            imagen: cfg.carpeta + imagen,
            cct: (o.ies.match(/(\d{4}K)/) || [])[1] || '',
            lumenes: Math.round(d.lumenes),
            watts: d.watts,
            apertura: d.simetrica ? `${Math.round(d.aperturaC0)}°` : `${Math.round(d.aperturaC0)}° × ${Math.round(d.aperturaC90)}°`,
            promedio: Math.round(st.prom),
            minimo: Math.round(st.min),
            maximo: Math.round(st.max),
            uniformidad: Math.round(st.uni * 100) / 100,
            trabajo: trabajo && {
              altura: cfg.trabajo,
              promedio: Math.round(trabajo.prom),
              minimo: Math.round(trabajo.min),
              maximo: Math.round(trabajo.max),
              uniformidad: Math.round(trabajo.uni * 100) / 100
            }
          });
        }
        const datos = {
          generado: new Date().toISOString(),
          superficie: cfg.superficie,
          referencia: cfg.referencia,
          producto: { ...cfg.producto, cantidad: estado.geo.luces.length },
          inicial: cfg.inicial || (opticas[0] && opticas[0].id),
          opticas
        };
        // Índice de mapas de la app: se lee, se actualiza esta escena y se vuelve a
        // escribir (el servidor deja una copia .bak.json del anterior).
        const INDICE = 'data/mapas-de-luz.json';
        const previo = await fetch('/' + INDICE, { cache: 'no-store' }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
        const indice = previo && previo.escenas ? previo : {
          _readme: 'Mapas de luz de las escenas de Ambientes. Lo escribe la herramienta interna /mapa-de-luz/ con "Guardar para la app"; no editar a mano. La clave es la foto principal de la escena.',
          escenas: {}
        };
        indice.escenas[cfg.carpeta + cfg.base + '.jpeg'] = datos;
        const res = await fetch('/__save?path=' + encodeURIComponent(INDICE), { method: 'POST', body: JSON.stringify(indice, null, 2) });
        const j = await res.json().catch(() => ({}));
        if (!j.ok) throw new Error('No se pudo anotar el mapa en ' + INDICE + ': ' + (j.error || res.status));
        await borrarCopiasGuardadas(reemplazadas);
        btn.textContent = `✓ ${opticas.length} ópticas guardadas en la app`;
      } catch (e) {
        btn.textContent = 'Guardar para la app';
        alert(e.message);
      } finally {
        // Volver a la óptica que estaba elegida
        await cargarIes(previa);
        $('#sel-ies').value = previa;
        mostrarFicha(); dibujarPolar();
        calcularGrilla(); calcularRebote(); dibujarMapa(); mostrarResultados();
        await dibujarSobreRender();
        btn.disabled = false;
      }
    });

    // Aplica la fotometría de una variante a las luces que coinciden (o vuelve a la de
    // 3ds Max con prop = null) y recalcula. Ej.: el BO 55 con lente oval, soft o sin lente.
    async function aplicarVariante(prop, originales) {
      for (const o of originales) { o.l.ies = o.ies; o.l.datos = o.datos; }
      if (prop && prop.ies) {
        estado.cacheIesRuta = estado.cacheIesRuta || {};
        for (const [clave, ruta] of Object.entries(prop.ies)) {
          if (!estado.cacheIesRuta[ruta]) {
            const r = await fetch(ruta.split('/').map(encodeURIComponent).join('/'));
            if (!r.ok) throw new Error(`No se pudo abrir el IES de la variante «${tx2(prop.nombre)}» (${r.status}): ${ruta}`);
            const ies = IES.parse(await r.text());
            estado.cacheIesRuta[ruta] = { ies, datos: IES.datos(ies) };
          }
          const c = estado.cacheIesRuta[ruta];
          for (const o of originales) {
            if ((o.l.iesRuta || '').toLowerCase().includes(clave.toLowerCase())) { o.l.ies = c.ies; o.l.datos = c.datos; }
          }
        }
      }
      // Grupos por fotometría: los usan la lista de productos, el título y la ficha
      if (estado.modoPorLuz) {
        const grupos = new Map();
        for (const l of estado.geo.luces) {
          if (!l.ies) continue;
          if (!grupos.has(l.ies)) grupos.set(l.ies, { ies: l.ies, datos: l.datos, n: 0 });
          grupos.get(l.ies).n++;
        }
        estado.iesPorLuz = [...grupos.values()].sort((a, b) => b.n - a.n);
      }
      calcularGrilla();
      calcularRebote();
    }

    // Productos de la escena con sus cantidades, según la fotometría que tiene cada luz ahora
    function productosDeLaEscena(cfg, prop) {
      const grupos = (estado.modoPorLuz && estado.iesPorLuz)
        ? estado.iesPorLuz.map((g) => {
            const l = estado.geo.luces.find((x) => x.ies === g.ies);
            return { clave: `${l ? l.iesRuta : ''} ${g.ies.nombre}`, datos: g.datos, n: g.n };
          })
        : [{ clave: `${estado.iesNombre} ${estado.ies.nombre}`, datos: estado.datosIes, n: estado.geo.luces.length }];
      return grupos.map((g) => {
        const m = (cfg.productos || []).find((p) => g.clave.toLowerCase().includes(p.ies.toLowerCase())) || {};
        const detalle = (prop && prop.detalle && m.id && prop.detalle[m.id]) || m.detalle || null;
        return {
          id: m.id || null, nombre: m.nombre || g.clave.trim(), detalle, cantidad: g.n,
          watts: g.datos.watts || null, lumenes: Math.round(g.datos.lumenesCalculados)
        };
      });
    }

    // Guarda PROPUESTAS de iluminación para la app. Con "variantes" en la escena, genera
    // una propuesta por variante (la misma distribución con otra óptica); si no, una sola.
    // Por cada propuesta: un mapa por terminación de los artefactos (blancos, negros…),
    // los números (piso, altura de trabajo y paredes) y la lista de productos. Las fotos
    // de la escena (una por terminación) se guardan una sola vez.
    async function guardarPropuesta(cfg, btn) {
      clearTimeout(pendienteRender);
      btn.disabled = true;
      const reemplazadas = [];
      const subir = async (nombre, blob) => {
        const res = await fetch('/__upload?reemplazar=1&path=' + encodeURIComponent(cfg.carpeta + nombre), { method: 'POST', body: blob });
        if (res.status === 404) throw new Error('Este servidor no guarda archivos. Abrí la herramienta desde luxa-server (http://localhost:8080/mapa-de-luz/).');
        const j = await res.json();
        if (!j.ok) throw new Error(j.error || 'no se pudo guardar');
        reemplazadas.push(cfg.carpeta + nombre);
        return j;
      };
      const redondear = (s) => ({ promedio: Math.round(s.prom), minimo: Math.round(s.min), maximo: Math.round(s.max), uniformidad: Math.round(s.uni * 100) / 100 });
      const originales = estado.geo.luces.map((l) => ({ l, ies: l.ies, datos: l.datos }));
      try {
        const conVariantes = !!(cfg.variantes && cfg.variantes.length);
        const variantes = conVariantes ? cfg.variantes : [{ id: cfg.propuesta.id, nombre: cfg.propuesta.nombre }];
        const terms = cfg.terminaciones && cfg.terminaciones.length ? cfg.terminaciones : [{ id: 'base', fondoMapa: null, foto: cfg.fotoEscena }];
        const nuevas = [];
        const fotos = [];

        for (let vi = 0; vi < variantes.length; vi++) {
          const prop = variantes[vi];
          await aplicarVariante(conVariantes ? prop : null, originales);
          const imagenes = {};
          let st = null, trabajo = null, paredes = null;
          for (let i = 0; i < terms.length; i++) {
            const tm = terms[i];
            btn.textContent = `Guardando «${tx2(prop.nombre)}» · ${i + 1} de ${terms.length}…`;
            await dibujarSobreRender(tm.fondoMapa ? { archivo: tm.fondoMapa } : null);
            const sup = estado.statsSuperficies.find((s) => !s.pared);
            if (!sup) throw new Error('Falta la máscara del piso: no hay mapa para guardar.');
            if (!st) {
              st = cfg.estadisticas === 'planta' ? statsPlanta(sup.altura) : sup;
              trabajo = cfg.trabajo != null ? statsPlanta(cfg.trabajo) : null;
              // Paredes: promedio de todas las que se ven, pesado por la superficie de cada una
              const ps = estado.statsSuperficies.filter((s) => s.pared && s.area > 0);
              const area = ps.reduce((a, s) => a + s.area, 0);
              if (area > 0) paredes = {
                promedio: Math.round(ps.reduce((a, s) => a + s.prom * s.area, 0) / area),
                minimo: Math.round(Math.min(...ps.map((s) => s.min))),
                maximo: Math.round(Math.max(...ps.map((s) => s.max)))
              };
            }
            const mapa = $('#compuesto');
            const escala = Math.min(1, 1800 / Math.max(mapa.width, mapa.height));
            const w = Math.round(mapa.width * escala), h = Math.round(mapa.height * escala);
            const nombreMapa = `${cfg.base} mapa ${prop.id}${terms.length > 1 ? ' ' + tm.id : ''}.jpeg`;
            await subir(nombreMapa, await imagenParaApp(mapa, w, h));
            imagenes[tm.id] = cfg.carpeta + nombreMapa;
            if (vi === 0 && tm.foto) {
              const foto = await cargarImagen('escenas/' + tm.foto);
              if (!foto) throw new Error('No encuentro el render ' + tm.foto);
              // La foto va exactamente al tamaño del mapa: así las capas calzan en la app
              // aunque el render con muebles (IA) haya salido con otra proporción.
              const nombreFoto = `${cfg.base}${i === 0 ? '' : ' ' + tm.id}.jpeg`;
              await subir(nombreFoto, await imagenParaApp(foto, w, h));
              fotos.push({ id: tm.id, nombre: tm.nombre || { es: tm.id, en: tm.id }, foto: cfg.carpeta + nombreFoto });
            }
          }
          nuevas.push({
            id: prop.id, nombre: prop.nombre, imagenes,
            productos: productosDeLaEscena(cfg, conVariantes ? prop : null),
            ...redondear(st),
            trabajo: trabajo ? { altura: cfg.trabajo, ...redondear(trabajo) } : null,
            paredes
          });
        }

        // Índice de la app. Con variantes, las propuestas de la escena son exactamente esas;
        // sin variantes, se reemplaza la del mismo id y se conservan las otras.
        const INDICE = 'data/mapas-de-luz.json';
        const previo = await fetch('/' + INDICE, { cache: 'no-store' }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
        const indice = previo && previo.escenas ? previo : {
          _readme: 'Mapas de luz de las escenas de Ambientes. Lo escribe la herramienta interna /mapa-de-luz/ con "Guardar para la app"; no editar a mano. La clave es la foto principal de la escena.',
          escenas: {}
        };
        const clave = cfg.carpeta + cfg.base + '.jpeg';
        const anterior = indice.escenas[clave] || {};
        const propuestas = conVariantes
          ? nuevas
          : (anterior.propuestas || []).filter((p) => !nuevas.some((n) => n.id === p.id)).concat(nuevas);
        const existe = (id) => id && propuestas.some((p) => p.id === id);
        indice.escenas[clave] = {
          generado: new Date().toISOString(),
          superficie: cfg.superficie,
          referencia: cfg.referencia,
          terminaciones: fotos.length > 1 ? fotos : (anterior.terminaciones || undefined),
          inicial: existe(cfg.inicial) ? cfg.inicial : (existe(anterior.inicial) ? anterior.inicial : propuestas[0].id),
          propuestas
        };
        const res = await fetch('/__save?path=' + encodeURIComponent(INDICE), { method: 'POST', body: JSON.stringify(indice, null, 2) });
        const j = await res.json().catch(() => ({}));
        if (!j.ok) throw new Error('No se pudo anotar el mapa en ' + INDICE + ': ' + (j.error || res.status));
        await borrarCopiasGuardadas(reemplazadas);
        btn.textContent = nuevas.length > 1
          ? `✓ ${nuevas.length} propuestas guardadas en la app`
          : `✓ Propuesta «${tx2(nuevas[0].nombre)}» guardada en la app`;
      } catch (e) {
        btn.textContent = 'Guardar para la app';
        alert(e.message);
      } finally {
        await aplicarVariante(null, originales);
        await dibujarSobreRender();
        btn.disabled = false;
      }
    }
    const tx2 = (o) => (o && typeof o === 'object' ? (o.es || o.en || '') : (o || ''));

    // Mismo tamaño y calidad que deja optimizar-imagenes.ps1 en los ambientes
    // (lado mayor 1800 px, calidad 82), así no hay que volver a optimizarla.
    // Con w y h, la imagen va exactamente a ese tamaño.
    function imagenParaApp(src, wFijo, hFijo) {
      src = src || $('#compuesto');
      const ancho = src.naturalWidth || src.width, alto = src.naturalHeight || src.height;
      const escala = Math.min(1, 1800 / Math.max(ancho, alto));
      const chica = document.createElement('canvas');
      chica.width = wFijo || Math.round(ancho * escala); chica.height = hFijo || Math.round(alto * escala);
      const c = chica.getContext('2d');
      c.imageSmoothingQuality = 'high';
      c.drawImage(src, 0, 0, chica.width, chica.height);
      return new Promise((ok) => chica.toBlob(ok, 'image/jpeg', 0.82));
    }

    // La app guarda en el navegador una copia de cada foto y después la usa sin
    // volver a pedirla. Cuando esta herramienta reemplaza una foto, hay que borrar
    // esa copia; si no, se siguen viendo las viejas hasta que se publique la app.
    async function borrarCopiasGuardadas(rutas) {
      if (!('caches' in window)) return 0;
      const urls = rutas.map((r) => new URL('/' + r.replace(/^\//, ''), location.origin).href);
      let n = 0;
      for (const k of await caches.keys()) {
        const cajon = await caches.open(k);
        for (const u of urls) if (await cajon.delete(u, { ignoreSearch: true })) n++;
      }
      return n;
    }

    $('#btn-descargar').addEventListener('click', () => {
      $('#compuesto').toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (estado.escena.nombre || 'escena').toLowerCase().replace(/\s+/g, '-') + ' mapa.jpg';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }, 'image/jpeg', 0.9);
    });

    // Lectura al pasar el mouse
    const canvas = $('#mapa'), tip = $('#tooltip');
    canvas.addEventListener('mousemove', (ev) => {
      const v = estado.vista; if (!v) return;
      const rect = canvas.getBoundingClientRect();
      const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
      const x = px / v.s - v.margen, y = estado.geo.L - (py / v.s - v.margen);
      if (x < 0 || y < 0 || x > estado.geo.W || y > estado.geo.L) { tip.hidden = true; return; }
      const lux = directa(x, y, estado.plano) + (estado.rebote ? estado.eInd : 0);
      tip.innerHTML = `<b>${fmt(lux)} lx</b> · a ${fmt(x, 2)} m de la ventana, ${fmt(y, 2)} m del frente`;
      tip.style.left = px + 'px'; tip.style.top = py + 'px'; tip.hidden = false;
    });
    canvas.addEventListener('mouseleave', () => { tip.hidden = true; });

    let t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(dibujarMapa, 120); });

    const img = $('#render');
    img.onload = () => { img.hidden = false; };
    img.onerror = () => { $('#render-falta').hidden = false; };
    if (esc.renderNoche) img.src = 'escenas/' + esc.renderNoche;
  }

  // Si el navegador guardó copias de los renders de la herramienta (versiones
  // anteriores del guardián de la app lo hacían), se borran: hay que calcular
  // siempre sobre el render que está hoy en la carpeta.
  async function borrarCopiasDeLaHerramienta() {
    if (!('caches' in window)) return;
    try {
      for (const k of await caches.keys()) {
        const cajon = await caches.open(k);
        for (const req of await cajon.keys()) {
          if (new URL(req.url).pathname.startsWith('/mapa-de-luz/')) await cajon.delete(req);
        }
      }
    } catch (e) { /* sin acceso a las copias: se sigue igual */ }
  }

  // Si la escena apunta a un archivo exportado desde 3ds Max (tools/3dsmax/
  // exportar-mapa-de-luz.ms), sus luces, cámara y caja reemplazan a los números
  // cargados a mano. Si el archivo no está, se sigue con los de la escena.
  async function importarDe3dsMax(esc) {
    if (!esc.importar3dsMax) return null;
    const r = await fetch('escenas/' + esc.importar3dsMax, { cache: 'no-store' }).catch(() => null);
    if (!r || !r.ok) return null;
    const m = await r.json();
    const v = (a) => ({ X: a[0], Y: a[1], Z: a[2] });
    const avisos = [];
    // Solo cuentan las luces que están dentro de la caja del ambiente: el archivo de
    // Max puede tener otras luces con IES en otras partes de la escena.
    const dentro = (l) => !m.caja || (l.pos[0] >= m.caja.min[0] && l.pos[0] <= m.caja.max[0] &&
                                       l.pos[1] >= m.caja.min[1] && l.pos[1] <= m.caja.max[1]);
    const fuera = m.luces.filter((l) => !dentro(l));
    m.luces = m.luces.filter(dentro);
    if (fuera.length) avisos.push(`${fuera.length} luces fuera del ambiente, no se cuentan (${fuera.map((l) => l.nombre).join(', ')})`);
    if (!m.luces.length) return { luces: 0, exportado: m.exportado, avisos: ['ninguna luz dentro del ambiente: se usan las cargadas a mano'] };
    esc.max.pulgada = m.metrosPorUnidad;
    // Ruta del IES de cada luz, relativa a la herramienta. Solo se usan IES que estén
    // dentro de assets/ies del proyecto (el servidor no puede abrir otras carpetas).
    const rutaIes = (p) => {
      if (!p) return null;
      const s = p.replace(/\\/g, '/'), i = s.toLowerCase().indexOf('assets/ies/');
      return i === -1 ? null : '../' + s.slice(i);
    };
    esc.max.luces = m.luces.map((l, i) => ({ id: 'L' + (i + 1), ...v(l.pos), rot: l.giroZ || 0, nombre: l.nombre, iesRuta: rutaIes(l.ies) }));
    const fueraDeAssets = m.luces.filter((l) => l.ies && !rutaIes(l.ies)).length;
    if (fueraDeAssets) avisos.push(`${fueraDeAssets} luces con IES fuera de assets/ies: copialos al proyecto`);
    if (m.caja) {
      esc.max.esquina = { X: m.caja.min[0], Y: m.caja.min[1] };
      esc.max.cajaAncho = m.caja.max[0] - m.caja.min[0];
      esc.max.cajaLargo = m.caja.max[1] - m.caja.min[1];
    }
    if (m.camara) {
      esc.max.camara = { ...v(m.camara.pos), objetivo: v(m.camara.objetivo), fovHorizontal: m.camara.fovHorizontal };
    }
    // Óptica: si todas las luces usan el mismo IES y está entre las disponibles, se elige esa
    const nombres = [...new Set(m.luces.map((l) => (l.ies || '').split(/[\\/]/).pop()).filter(Boolean))];
    if (nombres.length === 1 && esc.iesOpciones.includes(nombres[0])) esc.iesElegido = nombres[0];
    const sinIes = m.luces.filter((l) => !l.ies).length;
    if (sinIes) avisos.push(`${sinIes} luces sin IES`);
    if (!m.caja) avisos.push('sin caja del ambiente: se usan las medidas cargadas a mano');
    if (!m.camara) avisos.push('sin cámara: se usa la cargada a mano');
    return { luces: m.luces.length, exportado: m.exportado, avisos };
  }

  async function iniciar() {
    await borrarCopiasDeLaHerramienta();
    try {
      const r = await fetch('escenas/oficina-prueba.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('No se encontró la escena (escenas/oficina-prueba.json).');
      const esc = await r.json();
      const deMax = await importarDe3dsMax(esc);
      estado.escena = esc;
      estado.geo = geometria(esc);
      estado.plano = esc.planoTrabajo;
      estado.rho = { ...esc.reflectancias };
      const g = estado.geo;
      await cargarIes(esc.iesElegido);
      await cargarIesPorLuz();
      if (estado.modoPorLuz) usarProductoPrincipal();
      $('#escena-titulo').innerHTML = `<b>${esc.nombre}</b> · ${fmt(g.W, 2)} × ${fmt(g.L, 2)} m · ${composicion() || `${g.luces.length} × ${esc.producto}`}`;

      if (deMax) {
        const aviso = deMax.avisos.length ? ` · <span class="falta">${deMax.avisos.join(' · ')}</span>` : '';
        $('#escena-titulo').innerHTML += `<br>Datos de 3ds Max (${deMax.luces} luces, ${deMax.exportado})${aviso}`;
      }
      armarControles();
      dibujarLeyenda();
      mostrarFicha();
      dibujarPolar();
      recalcularTodo();
    } catch (e) {
      document.querySelector('.layout').innerHTML = `<p class="error">${e.message}</p>`;
      console.error(e);
    }
  }

  // Código de acceso: una barrera simple para compartir el link, no una seguridad real.
  // En la compu (localhost) no se pide; con ?codigo en la dirección se fuerza para probarlo.
  // Se guarda la huella (SHA-256) del código, no el código. Cada dispositivo lo pide una vez.
  const HUELLA_CODIGO = '3cefd4946bc669c584d394b8411d7abd792768c5491606eeaa290d91b96a538a';
  const CLAVE_ACCESO = 'td-light-study-acceso';
  async function huella(txt) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  function conAcceso() {
    const enLaCompu = ['localhost', '127.0.0.1'].includes(location.hostname);
    const forzar = new URLSearchParams(location.search).has('codigo');
    if (enLaCompu && !forzar) return Promise.resolve();
    try { if (!forzar && localStorage.getItem(CLAVE_ACCESO) === HUELLA_CODIGO) return Promise.resolve(); } catch (e) { /* sin almacenamiento: se pide siempre */ }
    document.body.classList.add('bloqueado');
    $('#acceso').hidden = false;
    $('#acceso-codigo').focus();
    return new Promise((ok) => {
      $('#acceso-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const h = await huella($('#acceso-codigo').value.trim().toLowerCase());
        if (h !== HUELLA_CODIGO) { $('#acceso-error').hidden = false; $('#acceso-codigo').select(); return; }
        try { localStorage.setItem(CLAVE_ACCESO, h); } catch (e) { /* no se recuerda, no pasa nada */ }
        $('#acceso').hidden = true;
        document.body.classList.remove('bloqueado');
        ok();
      });
    });
  }

  conAcceso().then(iniciar);
})();
