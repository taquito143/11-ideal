"""Arma data/clausura2026.json y data/clausura2026.js con los jugadores del Torneo Clausura 2026.

Fuentes:
  - data/afa/playersStatsFull.json y data/afa/teamsStats.json (AFA, plantel y estadisticas)
  - ../estadistitcas/2026 TORNEO CLAUSURA 2026 - A LA FECHA 16.xlsx (PrT = promedio por partido)
Uso:  python web/tools/extraer_afa.py   (desde la carpeta "11 ideal")
"""
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extraer_planillas as base  # noqa: E402

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "web"
AFA = WEB / "data" / "afa"
EXCEL = RAIZ / "estadistitcas" / "2026 TORNEO CLAUSURA 2026 - A LA FECHA 16.xlsx"
POSICION = {1: "ARQ", 2: "DEF", 3: "VOL", 4: "DEL"}


def norm(texto):
    t = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]", "", t.lower())


def clave_nombre(apellido, nombre):
    return norm(apellido) + "|" + norm((nombre or "").split()[0] if nombre else "")


def prt_del_excel():
    """Devuelve {(clave_nombre, equipo_norm): PrT} y {clave_nombre: [PrT, ...]} desde el Excel."""
    # Cada hoja (ARQ, DEF, VOL, DEL) lista solo los jugadores de su posicion en este libro.
    por_equipo, por_nombre = {}, {}
    with zipfile.ZipFile(EXCEL) as z:
        compartidas = base.leer_shared(z)
        hojas = base.hojas_del_libro(z)
        for hoja in ["ARQ", "DEF", "VOL", "DEL"]:
            filas = base.filas_de_hoja(z, hojas[hoja], compartidas)
            idx = next((i for i, f in enumerate(filas) if str(f.get("A", "")).strip() == "Jugador"), None)
            if idx is None:
                continue
            col = {str(v).strip(): k for k, v in filas[idx].items() if v}
            for fila in filas[idx + 1:]:
                nombre = str(fila.get(col.get("Jugador", "A")) or "")
                prt = base.a_numero(fila.get(col.get("PrT")))
                equipo = str(fila.get(col.get("Equipo"), "") or "")
                if "," not in nombre or prt is None:
                    continue
                apellido, _, pila = nombre.partition(",")
                apellido = apellido.strip().split()[0] if apellido.strip() else ""
                k = clave_nombre(apellido, pila.strip())
                por_equipo[(k, norm(equipo))] = prt
                por_nombre.setdefault(k, []).append(prt)
    return por_equipo, por_nombre


def main():
    ps = json.loads((AFA / "playersStatsFull.json").read_text(encoding="utf-8"))
    ts = json.loads((AFA / "teamsStats.json").read_text(encoding="utf-8"))
    equipos = {int(k): v["name"] for k, v in ts["teams"].items()}
    shorts = {int(k): (v.get("shortName") or v["name"]) for k, v in ts["teams"].items()}

    por_equipo, por_nombre = prt_del_excel()
    jugadores, sin_prt = [], 0
    for pid, p in ps["players"].items():
        nombre = p["name"]
        # Excel usa el primer apellido; AFA puede tener dos (ej. "Cortés Fernández").
        apellido1 = (nombre["last"] or "").split()[0] if nombre["last"] else ""
        k = clave_nombre(apellido1, nombre["first"])
        equipo = equipos.get(p["teamId"], "")
        prt = por_equipo.get((k, norm(shorts.get(p["teamId"], ""))))
        if prt is None:
            prt = por_equipo.get((k, norm(equipo)))
        if prt is None and len(por_nombre.get(k, [])) == 1:
            prt = por_nombre[k][0]
        if prt is None:
            sin_prt += 1
        pid_i = int(pid)
        jugadores.append({
            "id": pid_i,
            "torneo": "Clausura 2026 (AFA)",
            "jugador": nombre["nick"] or f'{nombre["last"]}, {nombre["first"]}',
            "pos": POSICION.get(p["posnId"], "VOL"),
            "equipoId": p["teamId"],
            "equipo": equipo,
            "partidos": ps["matches"].get(pid, {}).get("total", 0),
            "titulares": ps["matches"].get(pid, {}).get("holds", 0),
            "suplente": ps["matches"].get(pid, {}).get("substitute", 0),
            "minutos": ps["minutesPlayed"].get(pid, {}).get("total", 0),
            "goles": (ps["goals"].get(pid, {}).get("first_time", 0) + ps["goals"].get(pid, {}).get("second_time", 0)) if pid in ps["goals"] else 0,
            "amarillas": ps["cards"].get(pid, {}).get("yellow", 0),
            "rojas": ps["cards"].get(pid, {}).get("red", 0),
            "promedio": prt,
        })

    # Solo jugadores con partidos jugados en el torneo
    jugadores = [j for j in jugadores if j["partidos"] > 0]
    salida = {"torneo": "Clausura 2026 (AFA)", "equipos": [{"id": k, "nombre": v} for k, v in equipos.items()], "jugadores": jugadores}
    (WEB / "data" / "clausura2026.json").write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    (WEB / "data" / "clausura2026.js").write_text(
        "window.TORNEO_DATOS = " + json.dumps(salida, ensure_ascii=False) + ";\n", encoding="utf-8")
    con_prt = sum(1 for j in jugadores if j["promedio"] is not None)
    print(f"Jugadores con partidos: {len(jugadores)} | con PrT: {con_prt} | sin PrT: {len(jugadores) - con_prt}")


if __name__ == "__main__":
    main()
