# Ultimate 11 (futbol argentino) — análisis y roadmap

## 1. Qué es Ultimate 11 (según el paquete instalado)

Archivo analizado: `Ultimate+11_1.10.10_APKPure.xapk` (v1.10.10, código 24, paquete `com.vaultystudios.ultimate11`).

- Es una app **híbrida**: un APK de Android que envuelve una web app **Next.js** exportada (carpeta `assets/public/`, con `_next/static/chunks` de ~146 archivos JS), empaquetada con **Capacitor/Cordova**.
- Incluye Firebase (mensajería, crash reporting), anuncios (AD_ID, AdServices) y facturación (BILLING): es free-to-play con monetización.
- Pantallas de juego visibles en los assets: `ultimate-11/slot` (ruleta de jugadores), `ultimate-11/field` (cancha), `ultimate-11/shirt`, `ultimate-11/1v1`, `ultimate-11/results`, `ultimate-11/profile`, además de `boosters`, `challenge-event`, `leaderboard`, `trivia`, `xp/level-up`.

**Limitación:** no ubicamos todavía la fórmula exacta de simulación ni la probabilidad de la ruleta. El código está minificado y mezclado con render (PixiJS). Para extraerla hay que leer el módulo de `slot` y de resultados, o jugar la app y observar.

## 2. Mecánicas y decisiones tomadas

| Tema | Decisión |
|---|---|
| Ruleta | Muestra un jugador real por posición (ARQ / DEF / VOL / DEL) |
| Armado | El usuario elige en qué posición va cada jugador (11 titulares) |
| Puntaje de jugador | Media ponderada por posición de sus atributos (1–99) + bono por reputación internacional (0 a 3 pts, escala de 1 a 5 estrellas) |
| Puntaje de equipo | **Suma** de los 11 puntajes |
| Empate | Ver sección 4, punto B (los rangos no son claros todavía) |
| Rival | **Club real** de la liga; nuestro equipo es un club extra |
| Liga | **31 equipos** (30 clubes reales + el nuestro), todos contra todos **ida y vuelta** (60 fechas). Al final se suman puntos y se arma la tabla |
| Clasificación | Los **16 mejores** de la tabla entran al cuadro |
| Puntaje de jugador | **PrT** (promedio por partido) de las planillas |
| Once de cada club | Titulares = jugadores con más **CT** (partidos calificados) de cada equipo, balanceando posiciones; banco = los siguientes. Las planillas traen equipo y CT por jugador |
| Suplentes (nuestro equipo) | Banco de suplentes elegido en la ruleta. v1: reemplazos por posición cuando hay lesión o expulsión. v2: reemplazo por cansancio (fatiga) |
| Jugadores repetidos | Un jugador no puede estar en dos lugares. Si lo elegimos en nuestro equipo, sale del club real: su club lo reemplaza en el once con el siguiente jugador de esa posición (por CT). Es un cambio para toda la temporada simulada, no solo para un partido. Dentro de nuestro equipo, la ruleta no repite jugadores |
| AFA | La página de estadísticas es una app dinámica sin datos de alineación en el HTML. Se usan las planillas |
| Cuadro (llaves) | Siembra por posición: 1 y 16 → llave **A**; 2 y 15 → **B**; 3 y 14 → **C**; 4 y 13 → **D**; 5 y 12 → **E**; 6 y 11 → **F**; 7 y 10 → **G**; 8 y 9 → **H** |
| Ronda de llaves | Cada llave es una eliminatoria de 2 partidos (ida y vuelta). Pasan 8 ganadores |
| Cuartos | A vs B, C vs D, E vs F, G vs H (ida y vuelta). Pasan 4 |
| Semifinales | X = ganador(A,B) vs ganador(C,D); Y = ganador(E,F) vs ganador(G,H) (ida y vuelta) |
| Final | X vs Y en **partido único** |
| Tercer puesto | Perdedor de X vs perdedor de Y |
| Desempate por penales | Si la llave queda empatada en el global: penales simulados con los **5 mejores pateadores** de cada equipo (a definir el criterio de pateador) |
| Azar por partido | Factor aleatorio pequeño sobre el puntaje efectivo de cada equipo en cada partido |
| Localía | Bonus fijo para el equipo que juega de local (a calibrar) |
| Fatiga (v2) | Penalización si un jugador jugó partidos seguidos; se recupera con descanso |
| Racha (v2) | Ajuste chico según racha ganadora o perdedora, con tope |

## 3. Datos disponibles (`estadistitcas/`)

9 libros Excel de torneos (2022–2026), 21 hojas cada uno. Hallazgo importante sobre lo que contienen:

- Las hojas `ARQ`, `DEF`, `VOL`, `DEL`, `General` traen por jugador: **CT** (partidos calificados), **AcT** (puntaje acumulado en el torneo), **PrT** (promedio por partido), **GT / GJ / GC** (goles totales, de jugada y de cabeza), según la leyenda de cada hoja.
- `Puntos Por Equipo` trae los puntos por equipo, lo que sirve para la tabla.

**Brecha:** el Excel **no tiene los atributos de 1 a 99** (Ritmo, Tiro, Pase, Regate, Defensa, Físico) ni la **reputación internacional**. Esos valores no vienen en las planillas. Esto afecta la fórmula de puntaje (ver sección 4, punto A).

## 4. Puntos abiertos

**A. Fuente del puntaje de jugador (bloqueante).** Hay dos caminos:
- **A1 (recomendado para empezar):** usar el **PrT** (promedio por partido) de cada temporada ya cargado en el Excel como puntaje base. Es inmediato y con datos reales.
- **A2:** cargar a mano atributos 1–99 y reputación para cada jugador, y aplicar la media ponderada por posición. Es más fiel a Ultimate 11, pero requiere completar una base de datos grande. Los porcentajes por posición que describiste ya están definidos (suman 100% en cada puesto, lo verifiqué).

Además, el ejemplo práctico de la respuesta usa pesos por **categoría** (Tiro 45%, Ritmo 20%…), mientras que la tabla usa pesos por **atributo**. Hay que elegir uno.

**B. Regla de empate/victoria (a confirmar).** Interpreto los rangos como **porcentaje del total que le corresponde a nuestro equipo**: `nuestro / (nuestro + rival) × 100`.
- Menos de 40% → pierde; 40–60% → empata; más de 60% → gana.
- Consecuencia a revisar: con sumas de 11 jugadores, un equipo **20% más fuerte** da 54,5% y **empata**. Un 60/40 ya gana. ¿Está bien esa banda tan amplia, o preferís una más estrecha (por ejemplo 45–55%)?

**C. Resuelto:** 31 equipos (30 + el nuestro). Se pasa a 16 con la tabla final.

**F. Abiertos del cuadro (a confirmar):**
- **F1. Empate en la eliminatoria (ida y vuelta).** Si el total de ambos partidos queda empatado, ¿qué pasa? Propuesta: desempate por el puntaje del partido de vuelta, o penales simulados.
- **F2. Ida y vuelta con el mismo resultado.** Con la regla actual, el resultado depende solo de la comparación de puntajes totales. Como los equipos son los mismos en ambos partidos, el resultado sería **idéntico** en ida y vuelta (si gana uno, gana en los dos; si cae en banda de empate, empata en los dos). Para que la vuelta tenga sentido hay que agregar **azar** (variación aleatoria por partido) o **ventaja de localía**. ¿Cuál preferís?
- **F3.** Confirmo que los 16avos son las llaves A–H (dos equipos por llave) y que "a>b" son los cuartos.

**D. Fuente oficial (AFA).** La página https://www.afa.com.ar/es/pages/estadisticas-primera-division sirve para verificar o actualizar. Pendiente decidir si es fuente principal o solo control.

**E. Plataforma.** Recomiendo una web en un único HTML/JS, sin backend, con los datos de los Excel convertidos a JSON.

## 5. Roadmap con porcentajes

Porcentaje = avance estimado sobre el total del proyecto.

| # | Tarea | Estado | % acumulado |
|---|---|---|---|
| 1 | Análisis del APK (estructura, pantallas, mecánicas) | Parcial (fórmula de simulación no extraída) | 15% |
| 2 | Responder preguntas (secciones 2 y 4) | Completo: reglas definidas, incluido jugadores repetidos por toda la temporada | 30% |
| 3 | Modelo de datos: convertir los 9 Excel a JSON unificado (jugadores, equipos, temporadas) | Hecho: 1.160 registros en `ultimate-web/data/` | 35% |
| 4 | Definir puntaje de jugador (A1 o A2) y de equipo (suma), con fórmula documentada | Pendiente | 45% |
| 5 | Motor de partido: comparación de puntajes, banda de empate, resultado | Pendiente | 55% |
| 6 | Motor de torneo: ida y vuelta, tabla, 16 mejores, 16avos a semifinal ida y vuelta, final única | Pendiente | 65% |
| 7 | Ruleta: selección aleatoria de jugador por posición | Pendiente | 75% |
| 8 | Interfaz: armado del equipo (11 posiciones) y simulación del torneo | Pendiente | 85% |
| 9 | Pruebas: validar contra temporadas reales (los "FINALES") | Pendiente | 95% |
| 10 | Entrega (guía de uso, capturas) | Pendiente | 100% |

## 6. Próximo paso

Elegir la fuente del puntaje (A1 o A2) y confirmar la banda de empate (B). Con eso se fija la fórmula y se puede empezar la tarea 3.

## 7. Versión 3: modo presupuesto (decidido)

- **Qué es:** el jugador recibe un presupuesto inicial y arma su 11 ideal buscando jugadores entre los equipos. Sin ruleta.
- **Medida del presupuesto:** valor de mercado (€) de cada jugador según fifaindex (columna "Valor" de las páginas de equipo).
- **Presupuesto inicial:** 60% del costo del mejor 11 posible de la liga (el de mayor puntaje sin importar el precio).
- **Piso de control:** verificar que con ese presupuesto se pueda armar un 11 razonable.
- **Ajuste:** el porcentaje se puede subir o bajar según las pruebas.
- **Datos necesarios:** edad y país (AFA o fifaindex), valor y salario (fifaindex, páginas de equipo). Pendiente traer la columna de valor a `data/`.
- **Pendiente antes de arrancar:** terminar el puntaje por atributos (lote de fifaindex interrumpido), porque el costo del 11 perfecto depende del puntaje final.
