// Renders the AI eval fixtures (docs/PLAN.md: 10 technical sheets and 10 charging photos with
// known values). Synthetic on purpose: every expected value is printed by this script, so the
// eval measures reading, not knowledge. Run: node apps/web/scripts/make-ai-eval-fixtures.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const root = join(import.meta.dirname, "../test/ai-evals");
mkdirSync(join(root, "sheets"), { recursive: true });
mkdirSync(join(root, "photos"), { recursive: true });

const page = (body, css = "") => `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font-family:Helvetica,Arial,sans-serif;color:#111}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:6px 10px;text-align:left;font-size:15px}
th{background:#eee}h1{margin:0 0 4px}h2{margin:18px 0 6px;font-size:17px}${css}</style></head><body>${body}</body></html>`;

const rows = (pairs) =>
  `<table>${pairs.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>`;

// Technical sheets ------------------------------------------------------------------------
const sheets = [
  {
    id: "byd-dolphin",
    format: "png",
    html: page(
      `<div style="padding:28px;width:760px"><h1>BYD DOLPHIN 2025</h1><p>Versión GS · Ficha técnica Colombia</p>
      <h2>Batería y autonomía</h2>${rows([
        ["Capacidad de batería", "44,9 kWh"],
        ["Tipo de batería", "LFP (Blade)"],
        ["Autonomía (WLTP)", "340 km"],
        ["Consumo combinado", "15,9 kWh/100 km"],
      ])}<h2>Carga</h2>${rows([
        ["Cargador a bordo AC", "7 kW monofásico"],
        ["Carga rápida DC", "60 kW"],
        ["Conectores", "Tipo 2 (AC) / CCS2 (DC)"],
      ])}<h2>Dimensiones</h2>${rows([
        ["Peso en orden de marcha", "1.405 kg"],
        ["Largo", "4.290 mm"],
      ])}</div>`,
    ),
  },
  {
    id: "renault-kwid-etech",
    format: "pdf",
    html: page(
      `<div style="padding:40px"><h1>Renault Kwid E-Tech 100% eléctrico</h1><p>Modelo 2024 · Especificaciones</p>
      ${rows([
        ["Batería", "26,8 kWh"],
        ["Autonomía ciclo WLTP", "180 km"],
        ["Potencia motor", "48 kW (65 hp)"],
        ["Carga AC (Wallbox)", "7 kW, monofásica"],
        ["Carga DC", "30 kW"],
        ["Toma de carga", "CCS Combo 2"],
        ["Peso vacío", "977 kg"],
      ])}<p style="font-size:12px;color:#555">Imágenes de referencia. Equipamiento sujeto a cambios.</p></div>`,
    ),
  },
  {
    id: "kia-ev5",
    format: "pdf",
    html: page(
      `<div style="padding:40px"><h1>Kia EV5 Light — 2025</h1><p>Technical specifications</p>
      <h2>Battery</h2>${rows([
        ["Usable battery capacity", "64.2 kWh"],
        ["Chemistry", "LFP"],
        ["Driving range (CLTC)", "530 km"],
      ])}<h2>Charging</h2>${rows([
        ["On-board charger", "11 kW (3-phase)"],
        ["DC fast charging (max)", "102 kW"],
        ["Charging inlet", "Type 2 / CCS2"],
      ])}<h2>Weights</h2>${rows([["Curb weight", "1,870 kg"]])}</div>`,
    ),
  },
  {
    id: "deepal-s07",
    format: "png",
    html: page(
      `<div style="padding:28px;width:760px;background:#f7f7fb"><h1>深蓝 DEEPAL S07 2025</h1><p>纯电版 · Ficha técnica</p>
      ${rows([
        ["Capacidad batería (bruta)", "66,8 kWh"],
        ["Química", "Fosfato de hierro y litio (LFP)"],
        ["Autonomía CLTC", "520 km"],
        ["Carga lenta AC", "6,6 kW"],
        ["Carga rápida DC", "90 kW"],
        ["Puerto AC", "GB/T AC"],
        ["Puerto DC", "GB/T DC"],
        ["Peso en vacío", "1.980 kg"],
      ])}</div>`,
    ),
  },
  {
    id: "chevrolet-equinox-ev",
    format: "pdf",
    html: page(
      `<div style="padding:40px"><h1>2025 Chevrolet Equinox EV LT</h1>
      ${rows([
        ["Battery (usable)", "85 kWh"],
        ["EPA-estimated range", "513 km (319 mi)"],
        ["Level 2 on-board charger", "11.5 kW"],
        ["DC fast charging", "Up to 150 kW"],
        ["Charge port", "SAE J1772 / CCS1"],
        ["Curb weight", "2,350 kg"],
      ])}</div>`,
    ),
  },
  {
    id: "mg4",
    format: "png",
    html: page(
      `<div style="padding:28px;width:760px"><h1>MG4 Electric Comfort 2024</h1>
      ${rows([
        ["Batería bruta / útil", "51 kWh / 49 kWh"],
        ["Química", "LFP"],
        ["Autonomía WLTP", "350 km"],
        ["Cargador a bordo", "6,6 kW"],
        ["Potencia máx. DC", "117 kW"],
        ["Conectores", "Tipo 2 · CCS2"],
        ["Peso", "1.655 kg"],
      ])}</div>`,
    ),
  },
  {
    id: "volvo-ex30",
    format: "pdf",
    html: page(
      `<div style="padding:40px"><h1>Volvo EX30 Single Motor Extended Range — 2025</h1>
      ${rows([
        ["Batería (bruta / neta)", "69 kWh / 64 kWh"],
        ["Química", "NMC"],
        ["Autonomía WLTP", "476 km"],
        ["Consumo WLTP", "17,0 kWh/100 km"],
        ["Carga AC", "11 kW trifásica"],
        ["Carga DC máxima", "153 kW"],
        ["Conector", "Tipo 2 / CCS2"],
        ["Peso en vacío", "1.850 kg"],
      ])}</div>`,
    ),
  },
  {
    id: "jac-e10x-photo",
    format: "jpeg",
    html: page(
      `<div style="padding:60px;background:#6b6b6b"><div style="transform:rotate(-3deg);filter:blur(0.5px);background:#fffdf5;padding:26px;width:680px;box-shadow:0 8px 30px #0008">
      <h1>JAC E10X 2024</h1><p>Hoja de especificaciones</p>${rows([
        ["Capacidad de batería", "31,4 kWh"],
        ["Autonomía NEDC", "302 km"],
        ["Cargador a bordo", "6,6 kW"],
        ["Carga rápida", "40 kW DC"],
        ["Conectores", "Tipo 2 / CCS2"],
        ["Peso en vacío", "1.190 kg"],
      ])}</div></div>`,
    ),
  },
  {
    id: "hyundai-kona",
    format: "pdf",
    html: page(
      `<div style="padding:40px"><h1>Hyundai Kona Eléctrico 2025</h1><p>Versión batería de largo alcance</p>
      ${rows([
        ["Capacidad útil de batería", "64,8 kWh"],
        ["Autonomía WLTP", "454 km"],
        ["Consumo", "14,7 kWh/100 km"],
        ["Cargador a bordo", "10,5 kW (trifásico)"],
        ["Carga rápida DC", "102 kW"],
        ["Peso vacío", "1.720 kg"],
      ])}</div>`,
    ),
  },
  {
    id: "mazda-cx30-gasoline",
    format: "png",
    html: page(
      `<div style="padding:28px;width:760px"><h1>Mazda CX-30 2.0L Grand Touring 2025</h1>
      ${rows([
        ["Motor", "SKYACTIV-G 2.0 L, gasolina"],
        ["Potencia", "153 hp @ 6.000 rpm"],
        ["Tanque de combustible", "51 L"],
        ["Rendimiento combinado", "15,3 km/L"],
        ["Peso", "1.395 kg"],
      ])}</div>`,
    ),
  },
];

// Charging photos ---------------------------------------------------------------------------
const photo = (inner, { rotate = 0, blur = 0, bg = "#3b3f45" } = {}) =>
  page(
    `<div style="padding:50px;background:${bg};width:620px"><div style="transform:rotate(${rotate}deg);filter:blur(${blur}px)">${inner}</div></div>`,
  );
const receipt = (lines) =>
  `<div style="background:#fff;width:420px;padding:22px;font-family:'Courier New',monospace;font-size:16px;line-height:1.5;box-shadow:0 6px 24px #0007">${lines.join("<br>")}</div>`;
const screen = (body, bg = "#0f1720", fg = "#e8f0f8") =>
  `<div style="background:${bg};color:${fg};width:390px;padding:24px;border-radius:28px;font-size:17px;line-height:1.6">${body}</div>`;

const photos = [
  {
    id: "celsia-receipt",
    html: photo(
      receipt([
        "<b>ELECTROLINERA CELSIA</b>",
        "Cali - Valle",
        "--------------------------",
        "Fecha: 03/11/2026",
        "Inicio: 19:05   Fin: 20:12",
        "SoC inicial: 18 %",
        "SoC final:   76 %",
        "Energía: 28,46 kWh",
        "TOTAL: $36.998",
        "--------------------------",
        "Gracias por cargar con energía limpia",
      ]),
      { rotate: 2 },
    ),
  },
  {
    id: "terpel-voltex-app",
    html: photo(
      screen(`<div style="font-size:22px;font-weight:bold">Carga finalizada ✓</div>
      <div>Voltex Terpel Calle 80, Bogotá</div><hr>
      <div>02/11/2026 · 14:20 – 15:08</div><div>Energía cargada: <b>41,2 kWh</b></div>
      <div>Batería: 12 % → 85 %</div><div>Total pagado: <b>$70.040</b></div>`),
    ),
  },
  {
    id: "wallbox-home-app",
    html: photo(
      screen(
        `<div style="font-size:21px;font-weight:bold">Session summary</div><div>Home charger</div><hr>
      <div>Nov 1, 2026</div><div>22:30 – 05:10</div><div>Charged energy: <b>18.6 kWh</b></div>
      <div>Cost: <b>$13,950 COP</b></div>`,
        "#ffffff",
        "#1d2b36",
      ),
    ),
  },
  {
    id: "dashboard-cluster",
    html: photo(
      `<div style="background:#050608;color:#9ef0ff;width:560px;padding:30px;border-radius:120px/60px;font-size:22px;text-align:center;box-shadow:0 0 40px #000">
      <div style="font-size:16px">07:45</div><div style="font-size:30px">Carga completada · 82 %</div>
      <div>Autonomía 310 km</div><div style="font-size:18px">ODO 15.432 km</div></div>`,
      { blur: 0.4, bg: "#222" },
    ),
  },
  {
    id: "enelx-thermal-receipt",
    html: photo(
      receipt([
        "ENEL X WAY",
        "Estación Centro Mayor, Bogotá",
        "30/10/2026 08:12 - 09:01",
        "kWh: 9,87",
        "Valor: $14.805",
      ]),
      { rotate: -4, blur: 0.7 },
    ),
  },
  {
    id: "epm-station-screen",
    html: photo(
      screen(
        `<div style="font-size:20px">EPM · Los Molinos, Medellín</div><hr>
      <div>Energía entregada: 22,5 kWh</div><div>Tiempo: 00:35:12</div><div>SOC 54% → 81%</div><div>Costo: $33.750</div>`,
        "#00303f",
        "#ffffff",
      ),
    ),
  },
  {
    id: "shell-recharge-receipt",
    html: photo(
      receipt([
        "SHELL RECHARGE",
        "Autopista Medellín km 2, Cota",
        "Fecha 28/10/2026",
        "Hora 17:30 a 18:05",
        "Batería 40% a 70%",
        "Energía 15,0 kWh",
        "Total $25.500",
      ]),
    ),
  },
  {
    id: "gasoline-receipt",
    html: photo(
      receipt([
        "ESTACIÓN DE SERVICIO",
        "Gasolina corriente",
        "Galones: 8,5",
        "Precio/galón: $15.882",
        "TOTAL: $135.000",
        "27/10/2026 11:20",
      ]),
    ),
  },
  {
    id: "supercharger-app",
    html: photo(
      screen(`<div style="font-size:20px;font-weight:bold">Mall Plaza Supercharger, Bogotá</div><hr>
      <div>Nov 4, 2026, 9:15 PM – 10:02 PM</div><div>Added 34 kWh</div><div>20% → 72%</div><div>$51,000 COP</div>`),
    ),
  },
  {
    id: "primax-invoice",
    html: photo(
      `<div style="background:#fff;width:500px;padding:26px;font-size:16px;line-height:1.7;box-shadow:0 6px 24px #0007">
      <b>Electrolinera Primax Autopista Norte, Bogotá</b><br>Factura electrónica FE-20931<br>
      Fecha: 25/10/2026 10:00 - 11:10<br>Kilometraje: 23.118<br>Batería: 25% - 80%<br>Energía: 31,7 kWh<br>
      <b>Total a pagar: $47.550</b></div>`,
      { rotate: 1 },
    ),
  },
];

const browser = await chromium.launch();
const context = await browser.newContext({ deviceScaleFactor: 1.5 });
const tab = await context.newPage();
for (const sheet of sheets) {
  await tab.setContent(sheet.html);
  const file = join(
    root,
    "sheets",
    `${sheet.id}.${sheet.format === "jpeg" ? "jpg" : sheet.format}`,
  );
  if (sheet.format === "pdf") writeFileSync(file, await tab.pdf({ format: "A4" }));
  else
    await tab.locator("body > div").screenshot({
      path: file,
      type: sheet.format,
      ...(sheet.format === "jpeg" ? { quality: 75 } : {}),
    });
}
for (const item of photos) {
  await tab.setContent(item.html);
  await tab.locator("body > div").screenshot({
    path: join(root, "photos", `${item.id}.jpg`),
    type: "jpeg",
    quality: 72,
  });
}
await browser.close();
console.log(`Wrote ${sheets.length} sheets and ${photos.length} photos to ${root}`);
