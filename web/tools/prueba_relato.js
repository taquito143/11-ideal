// Prueba del relato: promedios de estadisticas y coherencia con el motor.
global.window = undefined;
var fs = require("fs");
var M = require("../motor.js");
var R = require("../relato.js");
var src = fs.readFileSync(__dirname + "/../data/jugadores.js", "utf8");
var JUG = eval(src.replace(/^[\s\S]*?=\s*/, "(").replace(/;\s*$/, ")"));
var T = M.torneosDisponibles(JUG)[0];
var clubes = M.construirClubes(JUG, T, {});
var nuestro = clubes.shift(); nuestro.nombre = "Nosotros"; nuestro.esNuestro = true;
var res = M.simularTorneo({ clubes: clubes, nuestro: nuestro, rng: M.crearRng(1234) });
var tot = { remates: 0, alArco: 0, corners: 0, faltas: 0, offsides: 0, atajadas: 0, amarillas: 0 }, n = 0, errores = 0, lineas = 0;
res.partidos.forEach(function (p) {
  var rel = R.generar(p, res.equipos[p.local], res.equipos[p.visitante]);
  var e = R.estadisticas(rel);
  if (e.L.goles !== p.golesL || e.V.goles !== p.golesV) errores++;
  if (e.L.alArco < e.L.goles || e.L.posesion + e.V.posesion !== 100) errores++;
  ["L", "V"].forEach(function (k) { Object.keys(tot).forEach(function (c) { tot[c] += e[k][c]; }); n++; });
  lineas += rel.lineas.filter(function (l) { return !l.silencioso; }).length;
  var again = R.generar(p, res.equipos[p.local], res.equipos[p.visitante]);
  if (JSON.stringify(again) !== JSON.stringify(rel)) errores++;
});
Object.keys(tot).forEach(function (c) { console.log(c, (tot[c] / n).toFixed(2), "por equipo"); });
console.log("lineas narradas por partido", (lineas / res.partidos.length).toFixed(1));
console.log("errores", errores);
var p = res.partidos.filter(function (x) { return x.golesL + x.golesV >= 3; })[0];
var rel = R.generar(p, res.equipos[p.local], res.equipos[p.visitante]);
rel.lineas.filter(function (l) { return !l.silencioso; }).forEach(function (l) { console.log(l.minuto + "'", l.texto); });
console.log(R.figura(rel));
