#!/usr/bin/env bash
# Envía N solicitudes y registra código y tiempo de cada una.
# Uso: scripts/carga.sh <escenario> <METODO> <url> [cuerpo-json] [N=100] [pausa-seg=0]
set -uo pipefail
ESCENARIO=$1; METODO=$2; URL=$3; CUERPO=${4:-}; N=${5:-100}; PAUSA=${6:-0}
RESULTADOS=${RESULTADOS:-../resultados}  # fuera del repo
mkdir -p "$RESULTADOS"
CSV=$RESULTADOS/$ESCENARIO.csv
RESPUESTA=$(mktemp)
echo "n,codigo,tiempo_ms,estados_precio" > "$CSV"

for i in $(seq 1 "$N"); do
  if [ -n "$CUERPO" ]; then
    SALIDA=$(curl -s -o "$RESPUESTA" -w '%{http_code} %{time_total}' -X "$METODO" "$URL" -H 'Content-Type: application/json' -d "$CUERPO")
  else
    SALIDA=$(curl -s -o "$RESPUESTA" -w '%{http_code} %{time_total}' -X "$METODO" "$URL")
  fi
  CODIGO=${SALIDA% *}
  MS=$(awk "BEGIN { printf \"%.0f\", ${SALIDA#* } * 1000 }")
  # Estados de precio de la respuesta, ej. "actual|no actualizado".
  ESTADOS=$(grep -o '"estadoPrecio":"[^"]*"' "$RESPUESTA" | cut -d'"' -f4 | sort -u | paste -sd'|' -)
  echo "$i,$CODIGO,$MS,$ESTADOS" >> "$CSV"
  sleep "$PAUSA"
done
rm -f "$RESPUESTA"

# Resumen: tasa de éxito (2xx), tiempo medio, p95 y máximo.
RESUMEN=$(tail -n +2 "$CSV" | cut -d, -f2,3 | sort -t, -k2 -n | awk -F, '
  { t[NR] = $2; suma += $2; if ($1 ~ /^2/) ok++ }
  END { p95 = t[int(NR * 0.95)]; printf "%d%%,%.0f,%d,%d", ok * 100 / NR, suma / NR, p95, t[NR] }')
[ -f $RESULTADOS/resumen.csv ] || echo "escenario,tasa_exito,media_ms,p95_ms,max_ms" > $RESULTADOS/resumen.csv
echo "$ESCENARIO,$RESUMEN" >> $RESULTADOS/resumen.csv
echo "$ESCENARIO -> éxito,media,p95,max (ms): $RESUMEN"
