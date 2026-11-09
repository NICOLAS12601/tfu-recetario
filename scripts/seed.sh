#!/usr/bin/env bash
# Carga los datos de prueba por la API (vía gateway). Si ya hay recetas, no hace nada.
set -euo pipefail
API=${API:-http://localhost}

if [ "$(curl -s "$API/recetas")" != "[]" ]; then
  echo "Ya hay datos cargados."; exit 0
fi

producto() { # nombre stock -> imprime el id
  curl -s -X POST "$API/productos" -H 'Content-Type: application/json' \
    -d "{\"nombre\":\"$1\",\"stock\":$2}" | sed -E 's/.*"id":"([^"]+)".*/\1/'
}
receta() { # nombre ingredientes-json
  curl -s -o /dev/null -X POST "$API/recetas" -H 'Content-Type: application/json' \
    -d "{\"nombre\":\"$1\",\"ingredientes\":$2}"
}

PAPA=$(producto Papa 5); CARNE=$(producto Carne 1); HUEVO=$(producto Huevo 10000)
PAN=$(producto Pan 0); CEBOLLA=$(producto Cebolla 0)

receta "Milanesa con papas" "[{\"productoId\":\"$PAPA\",\"cantidad\":3},{\"productoId\":\"$CARNE\",\"cantidad\":2},{\"productoId\":\"$HUEVO\",\"cantidad\":2},{\"productoId\":\"$PAN\",\"cantidad\":1}]"
receta "Tortilla de papas" "[{\"productoId\":\"$PAPA\",\"cantidad\":4},{\"productoId\":\"$HUEVO\",\"cantidad\":3},{\"productoId\":\"$CEBOLLA\",\"cantidad\":1}]"
receta "Huevo duro" "[{\"productoId\":\"$HUEVO\",\"cantidad\":1}]"
echo "Datos cargados."
