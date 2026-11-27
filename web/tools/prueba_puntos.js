// Prueba de los puntos tipo fantasy: promedios por puesto y figuras.
global.window = undefined;
var fs = require("fs");
var M = require("../motor.js");
var R = require("../relato.js");
var src = fs.readFileSync(__dirname + "/../data/jugadores.js", "utf8");
var JUG = eval(src.replace(/^[\s\S]*?=\s*/, "(").replace(/;\s*$/, ")"));
var T = M.torneosDisponibles(JUG)[0];
var porPos = {}, figPos = {}, errores = 0, partidos = 0, max = null;
for (var s = 1; s <= 10; s++) {
  var clubes = M.construirClubes(JUG, T, {});
  var nuestro = clubes.shift(); nuestro.nombre = "Nosotros"; nuestro.esNuestro = true;
  var res = M.simularTorneo({ clubes: clubes, nuestro: nuestro, rng: M.crearRng(s * 77) });
  res.partidos.forEach(function (p) {
    var aL = p.alineacionL || res.equipos[p.local], aV = p.alineacionV || res.equipos[p.visitante];
    var rel = R.generar(p, aL, aV), al = {};
    al[p.local] = aL; al[p.visitante] = aV;
    var pts = R.puntos(rel, al), claves = Object.keys(pts);
    if (claves.length !== 22) errores++;
    claves.forEach(function (k) {
      var x = pts[k], suma = x.detalle.reduce(function (a, d) { return a + d[1]; }, 0);
      if (suma !== x.total) errores++;
      (porPos[x.pos] = porPos[x.pos] || []).push(x.total);
      if (!max || x.total > max.total) max = x;
    });
    var f = R.figura(rel, al);
    if (!f) errores++; else figPos[pts[f.equipo + "|" + f.jugador].pos] = (figPos[pts[f.equipo + "|" + f.jugador].pos] || 0) + 1;
    partidos++;
  });
}
Object.keys(porPos).forEach(function (pos) {
  var l = porPos[pos], prom = l.reduce(function (a, b) { return a + b; }, 0) / l.length;
  console.log(pos, "promedio", prom.toFixed(2), "min", Math.min.apply(null, l), "max", Math.max.apply(null, l));
});
console.log("figuras por puesto", figPos, "partidos", partidos);
console.log("mejor actuacion", max.jugador, max.total, JSON.stringify(max.detalle));
console.log("errores", errores);
