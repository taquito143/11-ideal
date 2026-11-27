// Fatiga y rachas: efecto sobre goles, resultados y rotaciones en temporadas completas.
var fs = require("fs");
var M = require("../motor.js");
var src = fs.readFileSync(__dirname + "/../data/jugadores.js", "utf8");
var JUG = eval(src.replace(/^[\s\S]*?=\s*/, "(").replace(/;\s*$/, ")"));
var T = M.torneosDisponibles(JUG)[0];
function medir(opc, nombre) {
  var g = 0, n = 0, res = { L: 0, E: 0, V: 0 }, rot = 0, perdida = 0, cans = 0, nj = 0, campeones = {};
  for (var sem = 1; sem <= 30; sem++) {
    var clubes = M.construirClubes(JUG, T, {});
    var nuestro = clubes.shift(); nuestro.nombre = "Nosotros"; nuestro.esNuestro = true;
    var o = { clubes: clubes, nuestro: nuestro, rng: M.crearRng(sem * 104729) };
    for (var k in opc) o[k] = opc[k];
    var r = M.simularTorneo(o);
    r.partidos.forEach(function (p) {
      n++; g += p.golesL + p.golesV; res[p.resultado]++;
      [p.alineacionL, p.alineacionV].forEach(function (a) {
        rot += (a.rotaciones || []).length;
        if (a.puntajeNominal) perdida += 1 - a.puntaje / a.puntajeNominal;
        if (a.cansancio) Object.keys(a.cansancio).forEach(function (j) { cans += a.cansancio[j]; nj++; });
      });
    });
    var top = r.tabla[0].equipo.nombre; campeones[top] = (campeones[top] || 0) + 1;
  }
  console.log(nombre.padEnd(14), "goles/partido", (g / n).toFixed(2), "| L/E/V %", (res.L / n * 100).toFixed(1), (res.E / n * 100).toFixed(1), (res.V / n * 100).toFixed(1),
    "| rotaciones/equipo", (rot / n / 2).toFixed(2), "| perdida puntaje %", (perdida / n / 2 * 100).toFixed(2), "| cansancio medio", nj ? (cans / nj).toFixed(1) : "-",
    "| distintos 1ros", Object.keys(campeones).length);
}
medir({ sinFatiga: true, sinRachas: true }, "sin nada");
medir({ sinRachas: true }, "solo fatiga");
medir({}, "fatiga+racha");
