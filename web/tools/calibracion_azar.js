const M = require('../motor.js');
const datos = JSON.parse(require('fs').readFileSync(__dirname + '/../data/jugadores.json', 'utf8'));
const clubes = M.construirClubes(datos, '2026 TORNEO APERTURA', {});
const pts = clubes.map(c => c.puntaje);
console.log('Puntaje clubes min/media/max:', Math.min(...pts).toFixed(1), (pts.reduce((a,b)=>a+b)/pts.length).toFixed(1), Math.max(...pts).toFixed(1));
for (const azar of [0.05, 0.10, 0.15, 0.20]) {
  M.CONFIG.azarPorPartido = azar;
  const rng = M.crearRng(99); const c = { L: 0, E: 0, V: 0 };
  for (const a of clubes) for (const b of clubes) if (a !== b) c[M.partido(a, b, rng)]++;
  const t = c.L + c.E + c.V;
  console.log('azar', azar, ' gana local', (c.L/t*100).toFixed(1)+'%', ' empate', (c.E/t*100).toFixed(1)+'%', ' gana visitante', (c.V/t*100).toFixed(1)+'%');
}
