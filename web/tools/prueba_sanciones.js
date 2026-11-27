// Prueba de suspensiones: un expulsado (o con 4 amarillas) no juega el partido siguiente de su equipo.
var fs = require("fs");
var M = require("../motor.js");
var src = fs.readFileSync(__dirname + "/../data/jugadores.js", "utf8");
var JUG = eval(src.replace(/^[\s\S]*?=\s*/, "(").replace(/;\s*$/, ")"));
var T = M.torneosDisponibles(JUG)[0];
var errores = 0, bajas = 0, partidos = 0, sinBanco = 0;
for (var sem = 1; sem <= 20; sem++) {
  var clubes = M.construirClubes(JUG, T, {});
  clubes.forEach(function (c) { if ((c.banco || []).length < 7) sinBanco++; });
  var nuestro = clubes.shift(); nuestro.nombre = "Nosotros"; nuestro.esNuestro = true;
  var res = M.simularTorneo({ clubes: clubes, nuestro: nuestro, rng: M.crearRng(sem * 7919) });
  var lista = res.partidos.slice();
  res.rondas.forEach(function (r) { r.llaves.forEach(function (l) { [l.ida, l.vuelta, l.partido].forEach(function (p) { if (p) lista.push(p); }); }); });
  var pendiente = {}, amarillas = {};   // equipo -> {jugador:true}
  lista.forEach(function (p) {
    partidos++;
    [["L", p.local, p.alineacionL], ["V", p.visitante, p.alineacionV]].forEach(function (x) {
      var eq = x[1], al = x[2], susp = pendiente[eq] || {};
      al.once.forEach(function (j) { if (susp[j.jugador] && (al.banco || []).length) errores++; });
      if (al.once.length !== 11) errores++;
      bajas += (al.bajas || []).length;
      pendiente[eq] = {};
      amarillas[eq] = amarillas[eq] || {};
      p.eventos.forEach(function (e) {
        if (e.equipo !== eq) return;
        if (e.tipo === "roja") pendiente[eq][e.jugador] = true;
        if (e.tipo === "amarilla") { amarillas[eq][e.jugador] = (amarillas[eq][e.jugador] || 0) + 1; if (amarillas[eq][e.jugador] >= 4) { amarillas[eq][e.jugador] = 0; pendiente[eq][e.jugador] = true; } }
      });
    });
  });
}
console.log("partidos", partidos, "| bajas por partido y equipo", (bajas / partidos / 2).toFixed(2), "| clubes con banco incompleto", sinBanco / 20, "| errores", errores);
