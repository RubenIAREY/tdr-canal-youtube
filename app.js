/* Canal de YouTube de TDR · gráficas, simulador y calculadora.
   El modelo del simulador es el mismo que _proyeccion.py (VIDEOS/analisis-canal), para que la web y
   los escenarios publicados den lo mismo. */
"use strict";
const ROJO = "#e2001a", ROJO2 = "#ff3b4f", AMBAR = "#ffb547", GRIS = "#8a8a95", TEXTO = "#f2f2f4", SUAVE = "#a3a3ad", BORDE = "#2a2a33";
const fmt = (n, d = 0) => Number(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" });
const corto = n => n >= 1e6 ? fmt(n / 1e6, 2) + " M" : fmt(Math.round(n / 1000) * 1000);
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fecha = s => { const [y, m, d] = s.split("-"); return `${+d} ${MESES[+m - 1]} ${y.slice(2)}`; };
const fechaLarga = s => { const [y, m, d] = s.split("-"); return `${+d} ${MESES[+m - 1]} ${y}`; };

Chart.defaults.color = SUAVE;
Chart.defaults.font.family = "Inter, system-ui, sans-serif";
Chart.defaults.borderColor = BORDE;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.tooltip.backgroundColor = "#1e1e26";
Chart.defaults.plugins.tooltip.borderColor = BORDE;
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.maintainAspectRatio = false;

let D;
const graficas = {};

fetch("datos.json").then(r => r.json()).then(datos => {
  D = datos;
  document.querySelectorAll("[data-actualizado]").forEach(e => e.textContent = fechaLarga(D.actualizado));
  vivos(); semanas(); meses(); tipo(); largos(); web(); shorts(); proceso(); costes(); proyeccionInit();
  contadores(); aparicion(); navegacion(); videosClic();
});


/* ───────── 06/10 · cifras de hoy (salen de datos.json, que se regenera cada día) ───────── */
function vivos() {
  const A = D.antes_despues, an = A.antes, h = A.ahora || A.despues;
  const pon = (id, valor, dec, pre) => { const e = document.getElementById(id); if (!e) return;
    e.dataset.cuenta = valor; e.dataset.dec = dec || 0; if (pre) e.dataset.pre = pre; e.textContent = (pre || "") + fmt(valor, dec || 0); };
  const xv = h.vd / an.vd, xs = h.subs_mes / an.subs_mes;
  pon("vd-ahora", Math.round(h.vd)); pon("k-xvis", +xv.toFixed(1), 1, "×"); pon("k-xsubs", Math.round(xs), 0, "×");
  pon("k-views", D.canal.views); pon("k-subs", D.canal.subs);
  const t = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
  t("x-vis-txt", `${fmt(xv, 1)} veces más visitas`); t("x-subs-txt", `${fmt(xs, 0)} veces más suscriptores`);
  const f = new Date(D.actualizado); f.setDate(f.getDate() - 28);
  t("f-hoy", `últimos 28 días · hasta ${fechaLarga(D.actualizado)}`);
  const ex = (a, b) => ` <em>×${fmt(a / b, 1)}</em>`;
  const dd = (id, v, b) => { const e = document.getElementById(id); if (e) e.innerHTML = fmt(v) + ex(v, b); };
  dd("c-vd", h.vd, an.vd); dd("c-md", h.md, an.md); dd("c-subs", h.subs_mes, an.subs_mes);
  // me gusta al día en los tres tramos (del panel de redes, que está en el mismo repositorio)
  fetch("datos_redes.json?" + Date.now()).then(r => r.json()).then(RD => {
    const s = RD.series.youtube.filter(x => x[5] != null);
    if (!s.length) return;
    const lk = (a, b) => { const xs = s.filter(x => x[0] >= a && x[0] <= b); return xs.length ? xs.reduce((t, x) => t + x[5], 0) / xs.length : null; };
    const ult = s[s.length - 1][0], d28 = new Date(Date.parse(ult) - 27 * 864e5).toISOString().slice(0, 10);
    const v = [lk("2026-06-09", "2026-08-03"), lk("2026-08-04", "2026-09-28"), lk(d28, ult)];
    document.querySelectorAll(".comparativa .col dl").forEach((dl, i) => {
      if (dl.querySelector(".lk")) return;
      const dt = document.createElement("dt"); dt.textContent = "Me gusta al día"; dt.className = "lk";
      const dd = document.createElement("dd"); dd.innerHTML = fmt(v[i], 1) + (i > 0 && v[0] ? ` <em>×${fmt(v[i] / v[0], 1)}</em>` : "");
      dl.append(dt, dd);
    });
  }).catch(() => {});
  const W = D.web.meses, wt = document.getElementById("web-texto");
  if (wt && W.length) {
    const ult = W.slice(-3).map(m => `${fmt(m[1])} visitas en ${m[0]}`).join(", ");
    wt.innerHTML = `Sin rodeos: <strong>desde YouTube llegaron a la tienda ${ult}</strong>, y la última compra registrada que vino de YouTube
      fue el ${D.web.compra.mes} (${fmt(D.web.compra.importe, 2)} €). Es poco, y tiene explicación: el 90 % de las visitas son
      shorts, y en un short los enlaces de la descripción no se pueden pulsar.`;
  }
}

/* ───────── 01 · semanas ───────── */
function semanas() {
  const S = D.semanas.filter(s => s.s >= "2025-01-06");
  const idx = S.findIndex(s => s.s >= "2026-08-03");
  const nombres = { v: "Visitas", m: "Minutos vistos", g: "Suscriptores nuevos" };
  const datos = m => S.map(s => s[m]);
  const ch = new Chart(document.getElementById("g-semanas"), {
    type: "bar",
    data: { labels: S.map(s => fecha(s.s)), datasets: [{ label: nombres.v, data: datos("v"),
      backgroundColor: S.map((s, i) => i >= idx ? ROJO : "#3a3a46"), borderRadius: 3, barPercentage: .92, categoryPercentage: .96 }] },
    options: {
      plugins: { legend: { display: false },
        tooltip: { callbacks: { title: c => "Semana del " + c[0].label, label: c => `${c.dataset.label}: ${fmt(c.raw)}` } },
        annotation: { annotations: { eicma: { type: "label", xValue: S.findIndex(s => s.s >= "2025-11-03"), yValue: S.reduce((m, s) => Math.max(m, s.v), 0) * .93,
          content: ["EICMA 2025: cuatro shorts de motos", "virales una sola semana"], color: SUAVE, font: { size: 12 }, position: "start", xAdjust: 14 },
          sonda: { type: "line", xMin: idx - .5, xMax: idx - .5, borderColor: ROJO2, borderWidth: 2, borderDash: [6, 4],
          label: { display: true, content: "4 ago · sonda lambda, primer vídeo con IA", position: "start", backgroundColor: ROJO, color: "#fff", font: { weight: 700 } } } } } },
      scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } }, y: { beginAtZero: true, ticks: { callback: v => fmt(v) } } }
    }
  });
  graficas.semanas = ch;
  document.querySelectorAll('[data-grafica="semanas"] button').forEach(b => b.onclick = () => {
    b.parentNode.querySelectorAll("button").forEach(x => x.classList.toggle("activo", x === b));
    ch.data.datasets[0].data = datos(b.dataset.metrica); ch.data.datasets[0].label = nombres[b.dataset.metrica]; ch.update();
  });
}

/* ───────── 02 · meses y tipo ───────── */
function meses() {
  const M = D.meses;
  new Chart(document.getElementById("g-meses"), {
    data: { labels: M.map(m => m.m), datasets: [
      { type: "bar", label: "Visitas al día", data: M.map(m => m.vd), backgroundColor: M.map(m => /ago|sep|14/.test(m.m) ? ROJO : "#3a3a46"), borderRadius: 4, yAxisID: "y" },
      { type: "line", label: "Suscriptores netos al mes", data: M.map(m => m.subs_mes), borderColor: AMBAR, backgroundColor: AMBAR, tension: .3, pointRadius: 4, yAxisID: "y2" }] },
    options: { plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(c.raw, c.datasetIndex ? 1 : 0)}` } } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, title: { display: true, text: "visitas al día" } },
        y2: { beginAtZero: true, position: "right", grid: { display: false }, title: { display: true, text: "subs al mes" } } } }
  });
}
function tipo() {
  const T = D.tipo_semanas;
  new Chart(document.getElementById("g-tipo"), {
    type: "bar",
    data: { labels: T.map(t => fecha(t.s)), datasets: [
      { label: "Shorts", data: T.map(t => t.sh), backgroundColor: ROJO, borderRadius: 3 },
      { label: "Vídeos largos", data: T.map(t => t.lg), backgroundColor: TEXTO, borderRadius: 3 }] },
    options: { plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { title: c => "Semana del " + c[0].label, label: c => `${c.dataset.label}: ${fmt(c.raw)} visitas` } } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } }, y: { stacked: true, ticks: { callback: v => fmt(v) } } } }
  });
}

/* ───────── 03 · proyección ───────── */
const ESC = {
  pesimista: { exito_cada: 90, exito_vd: 60, medios_mes: 1, medio_vd: 8, flojo_vd: 1.0, mejora_mes: 0.00, shorts_mes: -0.02, sh_dia: 2.9, cada: 3 },
  normal:    { exito_cada: 60, exito_vd: 100, medios_mes: 2, medio_vd: 14, flojo_vd: 1.5, mejora_mes: 0.03, shorts_mes: 0.015, sh_dia: 2.9, cada: 3 },
  optimista: { exito_cada: 30, exito_vd: 120, medios_mes: 3, medio_vd: 15, flojo_vd: 2.0, mejora_mes: 0.05, shorts_mes: 0.03, sh_dia: 2.9, cada: 3 },
};
const COLOR = { pesimista: GRIS, normal: ROJO, optimista: AMBAR, propio: "#7cc7ff" };
const TEXTO_ESC = {
  pesimista: "Un éxito como el del turbo cada 3 meses (60 visitas al día), un vídeo medio al mes, sin mejora de calidad y shorts que pierden un 2 % al mes por saturación.",
  normal: "Un éxito cada 2 meses (100 visitas al día), dos medios al mes (14 al día), calidad que mejora un 3 % al mes y shorts que suben un 1,5 % al mes.",
  optimista: "Un éxito cada mes (120 visitas al día), tres medios al mes, calidad que mejora un 5 % al mes y shorts que suben un 3 % al mes.",
  propio: "Tus supuestos: mueve los mandos de abajo y todo se recalcula.",
};
let escActual = "normal", vistaActual = "vd", propio = { ...ESC.normal }, cache = {};

function simular(p) {
  const V0 = 265694, S0 = 347, SHORTS_HOY = 1559, VIEJOS = 60;
  const INI = Date.UTC(2026, 9, 1), FIN = Date.UTC(2027, 11, 31), DIA = 864e5;
  const ACTUALES = [[Date.UTC(2026, 7, 13), 110, "exito"], [Date.UTC(2026, 8, 11), 15, "medio"], [Date.UTC(2026, 8, 16), 14, "medio"]];
  const rampa = (edad, cl) => cl === "exito" ? (edad < 35 ? .12 : Math.min(1, .12 + (edad - 35) / 14)) : Math.min(1, edad / 21);
  const largos = ACTUALES.map(a => ({ d: a[0], vd: a[1], cl: a[2] }));
  const hist = []; for (let i = 0; i < 273; i++) hist.push(120); for (let i = 0; i < 92; i++) hist.push(14193 / 92);
  let suma = hist.reduce((a, b) => a + b, 0);
  let v = V0, s = S0, n = 0; const out = [], hitos = {}, cuenta = { exito: 0, medio: 0, flojo: 0 };
  const porMes = 30 / p.cada, cadaMedio = p.medios_mes > 0 ? Math.max(1, Math.round(porMes / p.medios_mes)) : Infinity;
  for (let t = INI; t <= FIN; t += DIA, n++) {
    const meses = (t - INI) / DIA / 30.44, calidad = 1 + p.mejora_mes * meses;
    if (n % p.cada === 0) {
      const k = Math.floor(n / p.cada); let cl, vd;
      if (k > 0 && (k * p.cada) % p.exito_cada < p.cada) { cl = "exito"; vd = p.exito_vd; }
      else if (k % cadaMedio === 1 || (cadaMedio === 1 && k > 0)) { cl = "medio"; vd = p.medio_vd * calidad; }
      else { cl = "flojo"; vd = p.flojo_vd * calidad; }
      largos.push({ d: t, vd, cl }); cuenta[cl]++;
    }
    let lg = VIEJOS;
    for (const L of largos) {
      const edad = (t - L.d) / DIA; if (edad < 0) continue;
      const decae = L.cl === "exito" ? Math.pow(.97, Math.max(0, (edad - 60) / 30.44)) : 1;
      lg += L.vd * rampa(edad, L.cl) * decae;
    }
    const sh = SHORTS_HOY * (p.sh_dia / 2.9) * (1 + p.shorts_mes * meses);
    v += sh + lg; s += (sh * .00125 + lg * .0025) * .91;
    hist.push(lg * 1.87); suma += lg * 1.87 - hist[hist.length - 366]; const horas = suma / 60;
    const iso = new Date(t).toISOString().slice(0, 10);
    if (s >= 1000 && !hitos.subs) hitos.subs = iso;
    if (horas >= 4000 && !hitos.horas) hitos.horas = iso;
    out.push({ d: iso, vd: sh + lg, sh, lg, v, s, h: horas });
  }
  return { out, hitos, cuenta };
}
function proyeccionInit() {
  for (const k of Object.keys(ESC)) cache[k] = simular(ESC[k]);
  cache.propio = simular(propio);
  const S = cache.normal.out, labels = S.map(o => o.d);
  graficas.proy = new Chart(document.getElementById("g-proy"), {
    type: "line", data: { labels, datasets: [] },
    options: {
      interaction: { mode: "index", intersect: false }, elements: { point: { radius: 0 } },
      plugins: { legend: { position: "bottom" },
        tooltip: { callbacks: { title: c => fechaLarga(c[0].label), label: c => `${c.dataset.label}: ${fmt(c.raw)}` } },
        annotation: { annotations: {} } },
      scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback(v, i) { const d = labels[i]; return d.endsWith("-01") && ["01", "04", "07", "10"].includes(d.slice(5, 7)) ? fecha(d) : ""; } } },
        y: { beginAtZero: true, stacked: false, ticks: { callback: v => fmt(v) } } }
    }
  });
  document.querySelectorAll(".pestanas button").forEach(b => b.onclick = () => {
    document.querySelectorAll(".pestanas button").forEach(x => x.classList.toggle("activo", x === b));
    escActual = b.dataset.esc; if (escActual !== "propio") { propio = { ...ESC[escActual] }; cache.propio = simular(propio); escribirMandos(); }
    pintarProy();
  });
  document.querySelectorAll('[data-grafica="proy"] button').forEach(b => b.onclick = () => {
    b.parentNode.querySelectorAll("button").forEach(x => x.classList.toggle("activo", x === b)); vistaActual = b.dataset.vista; pintarProy();
  });
  escribirMandos();
  document.querySelectorAll(".mandos input").forEach(inp => inp.oninput = () => {
    propio[inp.id] = +inp.value; escribirMandos(); cache.propio = simular(propio); escActual = "propio";
    document.querySelectorAll(".pestanas button").forEach(x => x.classList.toggle("activo", x.dataset.esc === "propio"));
    pintarProy();
  });
  pintarProy();
}
function escribirMandos() {
  const f = {
    exito_cada: v => fmt(v), exito_vd: v => fmt(v), medios_mes: v => fmt(v), medio_vd: v => fmt(v),
    mejora_mes: v => "+" + fmt(v * 100, 1) + " %", shorts_mes: v => (v >= 0 ? "+" : "") + fmt(v * 100, 1) + " %", sh_dia: v => fmt(v, 1), cada: v => fmt(v)
  };
  for (const k in f) { const i = document.getElementById(k); if (!i) continue; i.value = propio[k]; document.querySelector(`output[data-for="${k}"]`).textContent = f[k](propio[k]); }
}
function pintarProy() {
  const ch = graficas.proy, r = cache[escActual], S = r.out;
  document.getElementById("supuestos").textContent = TEXTO_ESC[escActual];
  const en = d => S.find(o => o.d === d);
  [["ene", "2027-01-01"], ["jun", "2027-06-30"], ["dic", "2027-12-31"]].forEach(([id, d]) => {
    const o = en(d); document.getElementById("p-" + id).textContent = corto(o.v) + " visitas";
    document.getElementById("p-" + id + "-s").textContent = `${fmt(o.s)} suscriptores · ${fmt(o.vd)} visitas al día`;
  });
  const mes = d => d ? `${MESES[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : "después de 2027";
  document.getElementById("p-1000").textContent = mes(r.hitos.subs);
  document.getElementById("p-4000").textContent = mes(r.hitos.horas);
  const c = COLOR[escActual], ann = {};
  ["2027-01-01", "2027-06-30"].forEach((d, i) => ann["f" + i] = { type: "line", xMin: d, xMax: d, borderColor: "#3a3a46", borderWidth: 1, borderDash: [4, 4] });
  let ds;
  if (vistaActual === "vd") {
    ds = [{ label: "Visitas de shorts al día", data: S.map(o => Math.round(o.sh)), borderColor: ROJO, backgroundColor: "rgba(226,0,26,.35)", fill: "origin", stack: "a", borderWidth: 2 },
          { label: "Visitas de largos al día", data: S.map(o => Math.round(o.lg)), borderColor: TEXTO, backgroundColor: "rgba(242,242,244,.28)", fill: "-1", stack: "a", borderWidth: 2 }];
    ch.options.scales.y.stacked = true;
  } else {
    const campo = vistaActual;
    ds = ["pesimista", "normal", "optimista"].map(k => ({ label: k[0].toUpperCase() + k.slice(1), data: cache[k].out.map(o => Math.round(o[campo])),
      borderColor: COLOR[k], borderWidth: k === escActual ? 4 : 2, borderDash: k === escActual ? [] : [5, 4], fill: false }));
    if (escActual === "propio") ds.push({ label: "Tu escenario", data: S.map(o => Math.round(o[campo])), borderColor: COLOR.propio, borderWidth: 4, fill: false });
    ch.options.scales.y.stacked = false;
    if (campo === "s") ann.meta = { type: "line", yMin: 1000, yMax: 1000, borderColor: ROJO2, borderWidth: 1, label: { display: true, content: "1.000 suscriptores", position: "start", backgroundColor: ROJO } };
    if (campo === "h") ann.meta = { type: "line", yMin: 4000, yMax: 4000, borderColor: ROJO2, borderWidth: 1, label: { display: true, content: "4.000 horas: se puede monetizar", position: "start", backgroundColor: ROJO } };
  }
  ch.data.datasets = ds; ch.options.plugins.annotation.annotations = ann; ch.update();
}

/* ───────── 04 · vídeos ───────── */
function largos() {
  const L = D.largos_ia, col = { exito: ROJO, medio: AMBAR, flojo: "#55555f" };
  const maxDias = Math.max(...L.map(x => x.acum.length));
  new Chart(document.getElementById("g-largos"), {
    type: "line",
    data: { labels: Array.from({ length: maxDias }, (_, i) => i + 1),
      datasets: L.map(x => ({ label: x.t.split(":")[0].slice(0, 42), data: x.acum, borderColor: col[x.clase], backgroundColor: col[x.clase],
        borderWidth: x.clase === "flojo" ? 1.5 : 3.5, pointRadius: 0, tension: .25 })) },
    options: { interaction: { mode: "nearest", intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: c => `Día ${c[0].label} desde que salió`, label: c => `${c.dataset.label}: ${fmt(c.raw)} visitas` } },
        annotation: { annotations: { sexta: { type: "line", xMin: 35, xMax: 35, borderColor: "#3a3a46", borderDash: [4, 4],
          label: { display: true, content: "6.ª semana: el turbo despega", position: "start", backgroundColor: "#26262e", color: TEXTO } } } } },
      scales: { x: { title: { display: true, text: "días desde la publicación" }, grid: { display: false }, ticks: { maxTicksLimit: 10 } },
        y: { title: { display: true, text: "visitas acumuladas" }, ticks: { callback: v => fmt(v) } } } }
  });
}
function shorts() {
  const box = document.getElementById("shorts");
  box.innerHTML = D.shorts.top.slice(0, 4).map(s => `<div class="short"><div class="yt" data-id="${s.id}"></div><p><b>${fmt(s.v)} visitas</b>${s.t}</p></div>`).join("");
  document.querySelectorAll("[data-enlaces]").forEach(e => e.textContent = D.web.con_enlace);
}
function videosClic() {
  document.querySelectorAll(".yt").forEach(el => {
    const id = el.dataset.id;
    el.style.backgroundImage = `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)`;
    el.setAttribute("role", "button"); el.setAttribute("aria-label", "Ver el vídeo");
    el.onclick = () => { if (el.classList.contains("cargado")) return; el.classList.add("cargado");
      el.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="Vídeo de TDR" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`; };
  });
}

/* ───────── 05 · web ───────── */
function web() {
  const M = D.web.meses;
  new Chart(document.getElementById("g-web"), {
    type: "bar",
    data: { labels: M.map(m => m[0]), datasets: [{ label: "Visitas a la tienda desde YouTube", data: M.map(m => m[1]),
      backgroundColor: M.map((m, i) => i >= M.length - 3 ? ROJO : "#3a3a46"), borderRadius: 4 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${fmt(c.raw)} visitas a todoenrecambio.com` } },
      title: { display: true, text: "Visitas a todoenrecambio.com que vienen de YouTube (2026)", color: TEXTO } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } }
  });
}

/* ───────── 06 · coste ───────── */
function costes() {
  const T = { hf: { id: "parte_hf", eur: 160, nom: "Higgsfield", col: ROJO }, cl: { id: "parte_cl", eur: 100, nom: "Claude", col: TEXTO },
              hg: { id: "parte_hg", eur: 25, nom: "HeyGen", col: AMBAR }, el: { id: "parte_el", eur: 10, nom: "ElevenLabs", col: "#7cc7ff" } };
  let ch;
  const pinta = () => {
    let total = 0; const yt = {};
    for (const k in T) {
      const parte = +document.getElementById(T[k].id).value; yt[k] = T[k].eur * parte; total += yt[k];
      document.querySelector(`output[data-for="${T[k].id}"]`).textContent = "YouTube " + fmt(parte * 100) + " %";
      document.getElementById("c-" + k).textContent = fmt(yt[k]) + " €";
    }
    document.getElementById("c-total").textContent = fmt(total) + " €";
    document.getElementById("c-mil").textContent = fmt(total / (1725.6 * 30.44 / 1000), 1) + " €";
    const ks = Object.keys(T);
    const sets = [{ label: "Antes: una persona", data: [500, 0, 0], backgroundColor: "#3a3a46" }]
      .concat(ks.map(k => ({ label: T[k].nom, data: [0, T[k].eur, yt[k]], backgroundColor: T[k].col })));
    if (!ch) {
      ch = new Chart(document.getElementById("g-coste"), {
        type: "bar",
        data: { labels: ["Antes", "Herramientas", "YouTube"], datasets: sets },
        options: { indexAxis: "y", plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(c.raw)} €` } },
          title: { display: true, text: "Coste al mes", color: TEXTO } },
          scales: { x: { stacked: true, ticks: { callback: v => v + " €" } }, y: { stacked: true, grid: { display: false } } } }
      });
    } else { ks.forEach((k, i) => ch.data.datasets[i + 1].data = [0, T[k].eur, yt[k]]); ch.update(); }
  };
  for (const k in T) document.getElementById(T[k].id).oninput = pinta;
  pinta();
}

/* ───────── 07 · proceso ───────── */
function proceso() {
  const P = [
    ["Tema e investigación", "ATLAS, nuestro agente, de noche", 90],
    ["Título y miniatura", "Claude Code + GPT Image 2.5 + logo real", 85],
    ["Guion", "Claude Code · Rubén lo revisa", 85],
    ["Voz", "ElevenLabs, por API", 100],
    ["Avatar de Rubén", "HeyGen, a mano: no tiene MCP", 15, true],
    ["Imágenes", "banco de ATLAS + GPT Image 2.5", 95],
    ["Clips de vídeo", "Higgsfield: Kling 3.0 Pro y Wan 3.0", 95],
    ["Pizarras y paneles", "código propio (Python y Pillow)", 100],
    ["Montaje y sonido", "ffmpeg, al fotograma", 100],
    ["Control de calidad", "labios, negros, parpadeos, enlaces", 100],
    ["Subida y programación", "API de YouTube y Metricool · OK de Rubén", 90],
    ["Shorts de cada día", "rutina automática", 95],
  ];
  document.getElementById("proceso").innerHTML = P.map(([t, q, p, m]) =>
    `<li class="${m ? "manual" : ""}"><h3>${t}</h3><p class="quien">${q}</p><div class="medidor"><i data-pct="${p}"></i></div><span class="pct">${p} % automático</span></li>`).join("");
  const media = Math.round(P.reduce((a, x) => a + x[2], 0) / P.length);
  document.getElementById("auto-media").textContent = media + " %";
}

/* ───────── animaciones ───────── */
function contadores() {
  const obs = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; obs.unobserve(e.target);
    const el = e.target, fin = +el.dataset.cuenta, dec = +(el.dataset.dec || 0);
    const pre = el.dataset.pre || (el.textContent.trim().startsWith("×") ? "×" : ""), t0 = performance.now();
    const paso = t => { const k = Math.min(1, (t - t0) / 1400), e2 = 1 - Math.pow(1 - k, 3);
      el.textContent = pre + fmt(fin * e2, dec); if (k < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }), { threshold: .4 });
  document.querySelectorAll("[data-cuenta]").forEach(e => obs.observe(e));
}
function aparicion() {
  const els = document.querySelectorAll(".bloque .contenedor > *, .kpi");
  els.forEach(e => e.classList.add("aparece"));
  const obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visto"); obs.unobserve(e.target);
    e.target.querySelectorAll?.(".medidor i").forEach(i => i.style.width = i.dataset.pct + "%"); } }), { threshold: .08 });
  els.forEach(e => obs.observe(e));
}
function navegacion() {
  const links = [...document.querySelectorAll(".barra nav a")];
  const obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle("activo", a.hash === "#" + e.target.id)); }), { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll("main section[id]").forEach(s => obs.observe(s));
}
