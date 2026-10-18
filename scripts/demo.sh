#!/usr/bin/env bash
#
# Pruebas manuales de cada patrón, una por subcomando. Pensado para ejecutar
# de a una y observar la salida.
#
# Uso:
#   ./scripts/demo.sh <patron>
#
# Patrones:
#   gatekeeper    API key, rutas, métodos y tamaño de cuerpo en el borde
#   offloading    TLS, compresión gzip y access log en el gateway
#   config-store  external configuration store: cambios en caliente
#   rate-limit    rate limiting (límite leído de la configuración)
#   retry         reintentos ante fallas transitorias del proveedor de precios
#   cache         cache-aside de precios
#   async         asynchronous request-reply
#   acid          consistencia ACID del consumo de stock
#
set -uo pipefail

BASE_URL="${BASE_URL:-https://localhost}"
API_KEY="${API_KEY:-clave-de-demo}"

t() { curl -sk -H "X-Api-Key: ${API_KEY}" "$@"; }
seccion() { printf '\n===== %s =====\n' "$1"; }
extraer_id() { grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4; }

receta_id() {
  if [ -n "${RECETA_ID:-}" ]; then printf '%s' "${RECETA_ID}"; return; fi
  local id
  id=$(t "${BASE_URL}/recetas" \
    | grep -o '"id":"[^"]*","nombre":"Milanesa de demo"' | head -n1 | cut -d'"' -f4)
  if [ -z "${id}" ]; then
    id=$(t "${BASE_URL}/recetas" | extraer_id)
  fi
  printf '%s' "${id}"
}

set_config() { # clave valor
  t -X PATCH -H "Content-Type: application/json" \
    -d "{\"valor\":\"$2\"}" "${BASE_URL}/configuracion/$1" >/dev/null
  printf '  %-26s = %s\n' "$1" "$2"
}

mostrar_config() {
  t "${BASE_URL}/configuracion" \
    | tr '}' '\n' \
    | grep -o '"clave":"[^"]*","valor":"[^"]*"' \
    | sed 's/^/  /'
}

contar_listas_ok() { # receta_id
  local ok=0 err=0 code
  for _ in $(seq 1 10); do
    code=$(t -o /dev/null -w '%{http_code}' "${BASE_URL}/lista-de-compras/receta/$1")
    if [ "${code}" = "200" ]; then ok=$((ok + 1)); else err=$((err + 1)); fi
  done
  printf '  de 10 listas -> %s respuestas 200 · %s con error\n' "${ok}" "${err}"
}

# Crea un producto y una receta con un nombre único y devuelve el id de la
# receta. Sirve para que la lista de compras tenga un faltante que todavía no
# se cotizó (cache frío) sin depender del estado previo de la API.
crear_faltante() {
  local nombre="demo-$$-${RANDOM}"
  local pid
  pid=$(t -X POST -H 'Content-Type: application/json' \
    -d "{\"nombre\":\"${nombre}\",\"stock\":0}" \
    "${BASE_URL}/productos" | extraer_id)
  t -X POST -H 'Content-Type: application/json' \
    -d "{\"nombre\":\"Receta ${nombre}\",\"ingredientes\":[{\"productoId\":\"${pid}\",\"cantidad\":1}]}" \
    "${BASE_URL}/recetas" | extraer_id
}

case "${1:-}" in
  gatekeeper)
    seccion "Gatekeeper: sin API key -> 401"
    curl -sk -o /dev/null -w '  HTTP %{http_code}\n' "${BASE_URL}/productos"

    seccion "Gatekeeper: con API key -> 200"
    t -o /dev/null -w '  HTTP %{http_code}\n' "${BASE_URL}/productos"

    seccion "Gatekeeper: ruta no prevista (/admin) -> 404"
    t -o /dev/null -w '  HTTP %{http_code}\n' "${BASE_URL}/admin"

    seccion "Gatekeeper: método no previsto (DELETE /productos) -> 405"
    t -o /dev/null -w '  HTTP %{http_code}\n' -X DELETE "${BASE_URL}/productos"

    seccion "Gatekeeper: cuerpo demasiado grande (>10k) -> 413"
    cuerpo=$(mktemp)
    printf '{"nombre":"%s","stock":1}' "$(head -c 20000 /dev/zero | tr '\0' 'a')" > "${cuerpo}"
    t -o /dev/null -w '  HTTP %{http_code}\n' -X POST \
      -H "Content-Type: application/json" --data-binary "@${cuerpo}" "${BASE_URL}/productos"
    rm -f "${cuerpo}"

    seccion "Gatekeeper: solo el gateway publica puertos"
    echo "  docker compose ps   # api y db no muestran puertos publicados"
    ;;

  offloading)
    seccion "Offloading: TLS terminado en el gateway (certificado autofirmado)"
    t -o /dev/null -w '  HTTP %{http_code} · handshake TLS en %{time_appconnect}s\n' \
      "${BASE_URL}/productos"

    seccion "Offloading: compresión gzip en el gateway"
    sin_comprimir=$(t -H 'Accept-Encoding: identity' -o /dev/null -w '%{size_download}' "${BASE_URL}/productos")
    con_gzip=$(t -H 'Accept-Encoding: gzip' -o /dev/null -w '%{size_download}' "${BASE_URL}/productos")
    printf '  sin comprimir: %s bytes\n  con gzip:      %s bytes\n' "${sin_comprimir}" "${con_gzip}"
    echo '  cabeceras relevantes:'
    t -H 'Accept-Encoding: gzip' -D - -o /dev/null "${BASE_URL}/productos" \
      | grep -iE '^(content-encoding|content-length|vary)' | sed 's/^/    /'

    seccion "Offloading: access log en el gateway"
    echo "  docker compose logs --tail=15 gateway"
    ;;

  config-store)
    seccion "External configuration store: valores actuales"
    mostrar_config

    seccion "Cambiar valores por la API (sin reiniciar la API)"
    set_config precio_probabilidad_falla 0.5
    set_config retry_intentos 5
    echo '  releyendo la tabla...'
    mostrar_config

    seccion "También se puede cambiar por SQL directo"
    echo "  docker compose exec db psql -U recetario -d recetario \\"
    echo "    -c \"UPDATE configuracion SET valor='0.3' WHERE clave='precio_probabilidad_falla'\""
    echo "  (la API refresca su copia local cada pocos segundos)"

    seccion "Restaurar valores por defecto"
    set_config precio_probabilidad_falla 0.3
    set_config retry_intentos 3
    ;;

  rate-limit)
    seccion "Rate limit: bajar el límite a 3 por minuto"
    set_config rate_limit_por_minuto 3

    seccion "Disparar 6 requests seguidas -> las últimas deben dar 429"
    for i in $(seq 1 6); do
      t -o /dev/null -w "  request ${i} -> HTTP %{http_code}\n" "${BASE_URL}/productos"
    done

    seccion "Restaurar el límite a 100"
    set_config rate_limit_por_minuto 100
    echo "  (la ventana de conteo se reinicia cada 60 s por cliente)"
    ;;

  retry)
    rid=$(crear_faltante)
    seccion "Retry: 70% de fallas y caché desactivada, con 1 solo intento"
    set_config cache_expiracion_ms 0
    set_config precio_probabilidad_falla 0.7
    set_config retry_intentos 1
    contar_listas_ok "${rid}"

    seccion "Retry: mismos 70% de fallas, pero ahora con 5 intentos"
    set_config retry_intentos 5
    contar_listas_ok "${rid}"

    seccion "Restaurar valores por defecto"
    set_config retry_intentos 3
    set_config precio_probabilidad_falla 0.3
    set_config cache_expiracion_ms 60000
    ;;

  cache)
    rid=$(crear_faltante)

    seccion "Cache-aside: primer pedido (cache miss -> llama al proveedor de precios)"
    t -o /dev/null -w '  HTTP %{http_code} · %{time_total}s\n' "${BASE_URL}/lista-de-compras/receta/${rid}"

    seccion "Cache-aside: segundo pedido inmediato (cache hit -> sin llamada de red)"
    t -o /dev/null -w '  HTTP %{http_code} · %{time_total}s\n' "${BASE_URL}/lista-de-compras/receta/${rid}"
    echo "  el segundo debería ser más rápido; la entrada expira según cache_expiracion_ms"
    ;;

  async)
    rid=$(receta_id)
    seccion "Asynchronous request-reply: encolar el pedido -> 202 + Location"
    cabeceras=$(mktemp)
    cuerpo=$(mktemp)
    curl -sk -X POST \
      -H "X-Api-Key: ${API_KEY}" -H 'Content-Type: application/json' \
      -d "{\"recetaIds\":[\"${rid}\"]}" \
      -D "${cabeceras}" -o "${cuerpo}" \
      "${BASE_URL}/lista-de-compras/solicitudes"
    grep -iE '^(HTTP/|location|retry-after)' "${cabeceras}" | sed 's/^/  /'
    printf '  cuerpo: %s\n' "$(cat "${cuerpo}")"
    solicitud_id=$(extraer_id < "${cuerpo}")

    seccion "Consultar el estado hasta que termine (polling)"
    for i in $(seq 1 10); do
      code=$(t -o /dev/null -w '%{http_code}' "${BASE_URL}/lista-de-compras/solicitudes/${solicitud_id}")
      printf '  intento %s -> HTTP %s\n' "${i}" "${code}"
      [ "${code}" = "200" ] && break
      sleep 1
    done
    t "${BASE_URL}/lista-de-compras/solicitudes/${solicitud_id}"; echo
    rm -f "${cabeceras}" "${cuerpo}"
    ;;

  acid)
    pid=$(t -X POST -H 'Content-Type: application/json' \
      -d "{\"nombre\":\"acido-$$-$RANDOM\",\"stock\":1}" \
      "${BASE_URL}/productos" | extraer_id)
    seccion "ACID: producto ${pid} con stock=1; dos consumos concurrentes de 1 unidad"
    r1=$(mktemp)
    r2=$(mktemp)
    t -X PATCH -H 'Content-Type: application/json' -d '{"cantidad":1}' \
      -o /dev/null -w '%{http_code}' "${BASE_URL}/productos/${pid}/consumir-stock" > "${r1}" &
    t -X PATCH -H 'Content-Type: application/json' -d '{"cantidad":1}' \
      -o /dev/null -w '%{http_code}' "${BASE_URL}/productos/${pid}/consumir-stock" > "${r2}" &
    wait
    printf '  request 1 -> HTTP %s\n  request 2 -> HTTP %s\n' "$(cat "${r1}")" "$(cat "${r2}")"
    seccion "ACID: stock final (nunca negativo)"
    t "${BASE_URL}/productos/${pid}"; echo
    rm -f "${r1}" "${r2}"
    ;;

  *)
    echo "Uso: $0 <patron>"
    echo
    echo "Patrones disponibles:"
    echo "  gatekeeper    API key, rutas, métodos y tamaño de cuerpo"
    echo "  offloading    TLS, compresión gzip y access log en el gateway"
    echo "  config-store  external configuration store (cambios en caliente)"
    echo "  rate-limit    rate limiting"
    echo "  retry         reintentos ante fallas transitorias"
    echo "  cache         cache-aside de precios"
    echo "  async         asynchronous request-reply"
    echo "  acid          consumo de stock transaccional"
    exit 1
    ;;
esac
