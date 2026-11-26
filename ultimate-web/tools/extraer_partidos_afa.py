"""Descarga los partidos terminados del Torneo Clausura 2026 (AFA) con sus eventos.

Guarda data/clausura2026_partidos.json: por partido, fecha, equipos, marcador,
goles (minuto y jugador), amarillas, rojas y cambios.

Uso:  python ultimate-web/tools/extraer_partidos_afa.py   (desde "11 ideal")
"""
import json
import re
import time
import urllib.request
from pathlib import Path

BASE = "https://info.afa.org.ar/deposito/html/v3/htmlCenter/data/deportes/futbol/primeraa/"
RAIZ = Path(__file__).resolve().parents[2]
SALIDA = RAIZ / "ultimate-web" / "data" / "clausura2026_partidos.json"
CABECERA = {"User-Agent": "Mozilla/5.0"}


def bajar(url):
    req = urllib.request.Request(url, headers=CABECERA)
    return urllib.request.urlopen(req, timeout=60).read().decode("utf-8", errors="replace")


def partidos_del_fixture():
    html = bajar(BASE + "pages/es/fixture.html")
    fecha = None
    lista = []
    for m in re.finditer(r'<div class="subHeader[^"]*">([^<]+)</div>|<div[^>]*mc-matchContainer[^>]*>', html):
        if m.group(1):
            fecha = m.group(1).strip()
            continue
        tag = m.group(0)
        canal = re.search(r'data-channel="deportes\.futbol\.primeraa\.(\d+)"', tag)
        if not canal:
            continue
        lista.append({
            "canal": int(canal.group(1)),
            "fase": fecha,
            "terminado": "status-finished" in tag,
        })
    return lista


def evento_lista(diccionario):
    return list((diccionario or {}).values())


def procesar(partido):
    ev = json.loads(bajar(BASE + f"events/{partido['canal']}.json?t=1"))
    m = ev["match"]
    inc = ev.get("incidences") or {}
    jugadores = {}
    for pid, p in (ev.get("players") or {}).items():
        jugadores[int(pid)] = (p.get("name") or {}).get("nick") or (p.get("name") or {}).get("shortName") or pid
    def minuto(e):
        t = e.get("t") or {}
        return (t.get("m") or 0) + (45 if t.get("half") == 2 and False else 0), t.get("half")
    goles = []
    for e in evento_lista(inc.get("goals")):
        goles.append({"equipo": e.get("team"), "jugadorId": e.get("plyrId"), "tipo": "gol",
                      "minuto": e["t"]["m"], "parte": e["t"]["half"]})
    amarillas = [{"equipo": e.get("team"), "jugadorId": e.get("plyrId"), "tipo": "amarilla",
                  "minuto": e["t"]["m"], "parte": e["t"]["half"]} for e in evento_lista(inc.get("yellowCards"))]
    rojas = [{"equipo": e.get("team"), "jugadorId": e.get("plyrId"), "tipo": "roja",
              "minuto": e["t"]["m"], "parte": e["t"]["half"]} for e in evento_lista(inc.get("redCards"))]
    cambios = [{"equipo": e.get("team"), "saleId": e.get("offId"), "entraId": e.get("inId"),
                "minuto": e["t"]["m"], "parte": e["t"]["half"]} for e in evento_lista(inc.get("substitutions"))]
    marcador = ev.get("scoreStatus") or {}
    return {
        "canal": partido["canal"],
        "fase": partido["fase"],
        "fecha": m.get("date"),
        "local": {"id": m["homeTeamId"], "nombre": m["homeTeamName"]},
        "visitante": {"id": m["awayTeamId"], "nombre": m["awayTeamName"]},
        "golesLocal": (marcador.get(str(m["homeTeamId"])) or {}).get("score"),
        "golesVisitante": (marcador.get(str(m["awayTeamId"])) or {}).get("score"),
        "eventos": sorted(goles + amarillas + rojas, key=lambda e: (e["parte"], e["minuto"])),
        "cambios": cambios,
        "jugadores": jugadores,
    }


def main():
    lista = [p for p in partidos_del_fixture() if p["terminado"]]
    print(f"Partidos terminados: {len(lista)}")
    resultados = []
    for i, p in enumerate(lista, 1):
        try:
            resultados.append(procesar(p))
        except Exception as error:  # noqa: BLE001
            print(f"Error en canal {p['canal']}: {error}")
        if i % 40 == 0:
            print(f"  {i}/{len(lista)}")
        time.sleep(0.05)
    SALIDA.write_text(json.dumps(resultados, ensure_ascii=False), encoding="utf-8")
    print(f"Guardados {len(resultados)} partidos en {SALIDA}")


if __name__ == "__main__":
    main()
