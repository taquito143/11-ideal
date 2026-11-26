"""Agrega a jugadores.json los eventos de cada jugador: goles (GT), amarillas (TA) y rojas (TR).

Uso (desde la carpeta del proyecto):
    python ultimate-web/tools/extraer_eventos.py
Reutiliza los lectores de extraer_planillas.py.
"""
import json
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extraer_planillas as base  # noqa: E402

RAIZ = Path(__file__).resolve().parents[2]
ORIGEN = RAIZ / "estadistitcas"
DESTINO = RAIZ / "ultimate-web" / "data" / "jugadores.json"


def eventos_de_libro(ruta):
    torneo = ruta.stem
    salida = {}
    with zipfile.ZipFile(ruta) as z:
        compartidas = base.leer_shared(z)
        hojas = base.hojas_del_libro(z)
        if "ARQ" not in hojas:
            return salida
        filas = base.filas_de_hoja(z, hojas["ARQ"], compartidas)
        idx = next((i for i, f in enumerate(filas) if str(f.get("A", "")).strip() == "Jugador"), None)
        if idx is None:
            return salida
        col = {str(v).strip(): k for k, v in filas[idx].items() if v}
        for fila in filas[idx + 1:]:
            nombre = fila.get(col.get("Jugador", "A"))
            equipo = str(fila.get(col.get("Equipo"), "") or "").strip()
            if not nombre or not equipo:
                continue
            clave = (torneo, str(nombre).strip(), equipo)
            salida.setdefault(clave, {
                "goles": base.a_numero(fila.get(col.get("GT"))) or 0,
                "amarillas": base.a_numero(fila.get(col.get("TA"))) or 0,
                "rojas": base.a_numero(fila.get(col.get("TR"))) or 0,
            })
    return salida


def main():
    mapa = {}
    for libro in sorted(ORIGEN.glob("*.xlsx")):
        mapa.update(eventos_de_libro(libro))
    jugadores = json.loads(DESTINO.read_text(encoding="utf-8"))
    sin_match = 0
    for j in jugadores:
        datos = mapa.get((j["torneo"], j["jugador"], j["equipo"]))
        if datos:
            j.update(datos)
        else:
            sin_match += 1
            j.update({"goles": 0, "amarillas": 0, "rojas": 0})
    DESTINO.write_text(json.dumps(jugadores, ensure_ascii=False, indent=1), encoding="utf-8")
    (DESTINO.parent / "jugadores.js").write_text(
        "window.JUGADORES = " + json.dumps(jugadores, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"{len(jugadores)} jugadores; sin datos de eventos: {sin_match}")


if __name__ == "__main__":
    main()
