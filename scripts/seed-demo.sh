#!/usr/bin/env bash
#
# Carga datos mínimos para probar la API: un producto con stock bajo y una
# receta que requiere más de lo que hay, para que la lista de compras siempre
# tenga algo que cotizar.
#
# Uso:
#   ./scripts/seed-demo.sh
#   BASE_URL=https://localhost API_KEY=clave-de-demo ./scripts/seed-demo.sh
#
set -euo pipefail

BASE_URL="${BASE_URL:-https://localhost}"
API_KEY="${API_KEY:-clave-de-demo}"

extraer_id() { grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4; }

echo "Sembrando datos en ${BASE_URL} ..."

# Reutiliza el producto si ya existe (el nombre es único).
PRODUCTO_ID="$(
  curl -sk -H "X-Api-Key: ${API_KEY}" "${BASE_URL}/productos" \
    | grep -o '{"id":"[^"]*","nombre":"carne"' | head -n1 | cut -d'"' -f4 || true
)"

if [ -z "${PRODUCTO_ID}" ]; then
  PRODUCTO_ID="$(
    curl -sk -X POST \
      -H "X-Api-Key: ${API_KEY}" -H "Content-Type: application/json" \
      -d '{"nombre":"carne","stock":1}' \
      "${BASE_URL}/productos" | extraer_id
  )"
  echo "  producto 'carne' creado (stock=1)"
else
  echo "  producto 'carne' ya existía (id ${PRODUCTO_ID})"
fi

RECETA_ID="$(
  curl -sk -H "X-Api-Key: ${API_KEY}" "${BASE_URL}/recetas" \
    | grep -o '"id":"[^"]*","nombre":"Milanesa de demo"' | head -n1 | cut -d'"' -f4 || true
)"

if [ -z "${RECETA_ID}" ]; then
  RECETA_ID="$(
    curl -sk -X POST \
      -H "X-Api-Key: ${API_KEY}" -H "Content-Type: application/json" \
      -d "{\"nombre\":\"Milanesa de demo\",\"ingredientes\":[{\"productoId\":\"${PRODUCTO_ID}\",\"cantidad\":5}]}" \
      "${BASE_URL}/recetas" | extraer_id
  )"
  echo "  receta 'Milanesa de demo' creada (id ${RECETA_ID})"
else
  echo "  receta 'Milanesa de demo' ya existía (id ${RECETA_ID})"
fi

# Productos de relleno: con body de pocos bytes gzip agrega overhead y no se
# nota la compresión del gateway. Con ~30 productos la respuesta ya es lo
# bastante grande como para que la comparación tenga sentido.
if curl -sk -H "X-Api-Key: ${API_KEY}" "${BASE_URL}/productos" | grep -q 'demo-bulk-01'; then
  echo "  productos de relleno ya existían"
else
  for i in $(seq 1 30); do
    curl -sk -X POST \
      -H "X-Api-Key: ${API_KEY}" -H "Content-Type: application/json" \
      -d "{\"nombre\":\"demo-bulk-$(printf '%02d' "${i}")\",\"stock\":10}" \
      "${BASE_URL}/productos" >/dev/null
  done
  echo "  30 productos de relleno creados (demo-bulk-01 .. demo-bulk-30)"
fi

echo
echo "Exportá estas variables para que los scripts de prueba las reutilicen:"
echo "  export PRODUCTO_ID=${PRODUCTO_ID}"
echo "  export RECETA_ID=${RECETA_ID}"
