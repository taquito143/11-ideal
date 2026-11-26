# 11 Ideal Argentina

Armá tu 11 ideal del fútbol argentino con un presupuesto y simulá el Torneo Clausura 2026 como si tu equipo fuera uno más de la liga.

**Jugar:** https://taquito143.github.io/11-ideal/ (redirige a `web/`)

## Cómo funciona

- **Mercado con presupuesto:** fichás 11 titulares y 7 suplentes con su valor de mercado. El presupuesto es el 60% del costo del plantel perfecto.
- **Puntajes:** cada jugador tiene un puntaje calculado con sus atributos de FIFA (EA FC), ponderados según su posición.
- **Simulación:** liga de 31 equipos (los 30 clubes + el tuyo) a ida y vuelta; los 16 mejores pasan a un cuadro con llaves, semifinales y final. El motor está calibrado con los resultados reales de la Clausura 2026.
- **Simulación lenta:** partido a partido, con relato en vivo (tiempo real, 2x o 4x).

## Estructura

- `web/` — la web (HTML, CSS y JS sin dependencias). Es lo que se publica en GitHub Pages.
- `web/motor.js` — motor de simulación.
- `web/data/` — datos procesados de jugadores y partidos.
- `web/tools/` — scripts para generar los datos.
- `analisis_y_roadmap.md` — análisis inicial y roadmap.

## Probar en local

```
python -m http.server 8765 --directory web
```

y abrir http://localhost:8765.

## Fuentes de datos

Estadísticas de partidos y planteles de AFA; valoraciones y atributos de FIFA Index y SoFIFA.
