// Efecto de la mentalidad y el capitan: equipos parejos y equipo fuerte vs debil.
var M = require("../motor.js");
function equipo(n, puntaje, ment) {
  var once = [];
  for (var i = 0; i < 11; i++) once.push({ jugador: n + i, pos: i === 0 ? "ARQ" : "VOL", promedio: puntaje / 11, partidos: 10, goles: 1, amarillas: 0, rojas: 0 });
  return { nombre: n, once: once, puntaje: puntaje, mentalidad: ment, capitan: n + "5" };
}
function prueba(pL, pV, mL, mV) {
  var rng = M.crearRng(42), c = { L: 0, E: 0, V: 0 }, g = 0, N = 20000;
  for (var i = 0; i < N; i++) {
    var pr = M.jugarPartido(equipo("A", pL, mL), equipo("B", pV, mV), rng);
    c[pr.resultado]++; g += pr.golesL + pr.golesV;
  }
  console.log((pL + " vs " + pV).padEnd(11), (mL + "/" + mV).padEnd(22), "G", (c.L / N * 100).toFixed(1), "E", (c.E / N * 100).toFixed(1), "P", (c.V / N * 100).toFixed(1), "goles", (g / N).toFixed(2), "pts", ((3 * c.L + c.E) / N).toFixed(3));
}
["equilibrada", "defensiva", "ofensiva"].forEach(function (m) { prueba(724, 724, m, "equilibrada"); });
["equilibrada", "defensiva", "ofensiva"].forEach(function (m) { prueba(800, 700, m, "equilibrada"); });
["equilibrada", "defensiva", "ofensiva"].forEach(function (m) { prueba(680, 760, m, "equilibrada"); });
