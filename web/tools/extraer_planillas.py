"""Convierte las planillas Excel de estadisticas a un JSON unificado para la web.

Uso (desde la carpeta del proyecto):
    python web/tools/extraer_planillas.py

Lee todos los .xlsx de la carpeta "estadistitcas" y, de las hojas ARQ, DEF, VOL y DEL,
genera web/data/jugadores.json con: torneo, jugador, pos, equipo,
cotizacion, partidos (CT), puntaje acumulado (AcT) y promedio (PrT).
"""
import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
HOJAS = ["ARQ"]  # la hoja ARQ trae la lista completa de jugadores con su columna POS

RAIZ = Path(__file__).resolve().parents[2]
ORIGEN = RAIZ / "estadistitcas"
DESTINO = RAIZ / "web" / "data" / "jugadores.json"


def leer_shared(z):
    try:
        raiz = ET.fromstring(z.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    out = []
    for si in raiz.findall("m:si", NS):
        out.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
    return out


def hojas_del_libro(z):
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    mapa_rels = {r.get("Id"): r.get("Target") for r in rels}
    out = {}
    for s in wb.find("m:sheets", NS):
        rid = s.get("{%s}id" % NS["r"])
        destino = mapa_rels[rid].lstrip("/")
        if not destino.startswith("xl/"):
            destino = "xl/" + destino
        out[s.get("name").strip()] = destino
    return out


def columna_letra(ref):
    return re.match(r"[A-Z]+", ref).group(0)


def filas_de_hoja(z, ruta, compartidas):
    raiz = ET.fromstring(z.read(ruta))
    filas = []
    for fila in raiz.iter("{%s}row" % NS["m"]):
        valores = {}
        for c in fila.findall("m:c", NS):
            tipo = c.get("t")
            v = c.find("m:v", NS)
            if tipo == "s" and v is not None:
                valor = compartidas[int(v.text)]
            elif tipo == "inlineStr":
                valor = "".join(t.text or "" for t in c.iter("{%s}t" % NS["m"]))
            else:
                valor = v.text if v is not None else None
            valores[columna_letra(c.get("r"))] = valor
        filas.append(valores)
    return filas


def a_numero(valor):
    if valor is None or valor == "":
        return None
    try:
        return float(str(valor).replace(",", "."))
    except ValueError:
        return None


def procesar_libro(ruta):
    torneo = ruta.stem
    registros = []
    with zipfile.ZipFile(ruta) as z:
        compartidas = leer_shared(z)
        hojas = hojas_del_libro(z)
        for hoja in HOJAS:
            if hoja not in hojas:
                continue
            filas = filas_de_hoja(z, hojas[hoja], compartidas)
            cabecera_idx = next((i for i, f in enumerate(filas) if str(f.get("A", "")).strip() == "Jugador"), None)
            if cabecera_idx is None:
                continue
            cabecera = filas[cabecera_idx]
            col = {str(v).strip(): k for k, v in cabecera.items() if v}
            for fila in filas[cabecera_idx + 1:]:
                nombre = fila.get(col.get("Jugador", "A"))
                if not nombre or not str(nombre).strip():
                    continue
                pos = str(fila.get(col.get("POS"), "") or "").strip()
                equipo = str(fila.get(col.get("Equipo"), "") or "").strip()
                if pos not in ("ARQ", "DEF", "VOL", "DEL") or not equipo:
                    continue
                registros.append({
                    "torneo": torneo,
                    "jugador": str(nombre).strip(),
                    "pos": pos,
                    "equipo": str(fila.get(col.get("Equipo"), "") or "").strip(),
                    "cotizacion": a_numero(fila.get(col.get("Cotización"))),
                    "partidos": a_numero(fila.get(col.get("CT"))),
                    "puntajeAcumulado": a_numero(fila.get(col.get("AcT"))),
                    "promedio": a_numero(fila.get(col.get("PrT"))),
                })
    vistos = set()
    unicos = []
    for r in registros:
        clave = (r["torneo"], r["jugador"], r["equipo"])
        if clave not in vistos:
            vistos.add(clave)
            unicos.append(r)
    return unicos


def main():
    if not ORIGEN.exists():
        sys.exit(f"No existe la carpeta {ORIGEN}")
    todos = []
    for libro in sorted(ORIGEN.glob("*.xlsx")):
        registros = procesar_libro(libro)
        print(f"{libro.name}: {len(registros)} jugadores")
        todos.extend(registros)
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(json.dumps(todos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Total: {len(todos)} registros -> {DESTINO}")


if __name__ == "__main__":
    main()
