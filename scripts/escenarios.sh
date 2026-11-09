#!/usr/bin/env bash
# Corre los 4 escenarios de disponibilidad (100 solicitudes cada uno) por el gateway.
set -euo pipefail
cd "$(dirname "$0")/.."
API=http://localhost
rm -f ../resultados/*.csv

esperar() { until curl -s -o /dev/null "$1"; do sleep 1; done; } # hasta que el puerto responda
id_receta() { curl -s $API/recetas | grep -o "\"id\":\"[^\"]*\",\"nombre\":\"$1" | cut -d'"' -f4; }

./scripts/seed.sh
MILANESA=$(id_receta Milanesa); TORTILLA=$(id_receta Tortilla); HUEVO_DURO=$(id_receta 'Huevo duro')
LISTA="{\"recetaIds\":[\"$MILANESA\",\"$TORTILLA\"]}"

echo "== 1. Línea base: todo activo"
./scripts/carga.sh 1-linea-base POST $API/listas "$LISTA"

echo "== 2. Cae Precios (con Circuit Breaker)"
docker stop precios >/dev/null
./scripts/carga.sh 2-cae-precios POST $API/listas "$LISTA"

echo "== 4. Recuperación: vuelve Precios"
docker start precios >/dev/null
esperar http://localhost:8082/precios
# Pausa de 0,2 s: las 100 listas duran ~20 s y cubren los 10 s de circuito abierto.
./scripts/carga.sh 4-recuperacion POST $API/listas "$LISTA" 100 0.2
docker logs lista-compras 2>&1 | grep 'Circuit Breaker' | tr -d '\033' | sed -e 's/.*Circuit/Circuit/' -e 's/\[[0-9;]*m//g' > ../resultados/transiciones-circuito.txt
cat ../resultados/transiciones-circuito.txt

echo "== 2b. Cae Precios SIN Circuit Breaker (solo timeout + reintentos)"
CB_ENABLED=false docker compose up -d lista-compras >/dev/null 2>&1
esperar http://localhost:8080/listas
curl -s -o /dev/null -X POST $API/listas -H 'Content-Type: application/json' -d "$LISTA" # llena la caché
docker stop precios >/dev/null
./scripts/carga.sh 2b-cae-precios-sin-cb POST $API/listas "$LISTA"
docker start precios >/dev/null
docker compose up -d lista-compras >/dev/null 2>&1   # vuelve con Circuit Breaker
esperar http://localhost:8080/listas

echo "== 3. Cae Lista de Compras: se sigue cocinando"
docker stop lista-compras >/dev/null
echo "  /listas por el gateway: $(curl -s -o /dev/null -w '%{http_code}' -X POST $API/listas -H 'Content-Type: application/json' -d "$LISTA")"
./scripts/carga.sh 3-cae-lista-compras POST "$API/recetas/$HUEVO_DURO/cocinar"
docker start lista-compras >/dev/null

echo; column -t -s, ../resultados/resumen.csv
