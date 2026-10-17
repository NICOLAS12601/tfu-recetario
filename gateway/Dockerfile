# Contenedor de entrada único. Implementa dos patrones:
#   - Gatekeeper: exige API key y rechaza rutas, métodos y tamaños de cuerpo
#     no previstos ANTES de que el pedido llegue a la API.
#   - Gateway Offloading: se hace cargo del cifrado (TLS), la compresión
#     (gzip) y el registro de acceso, así la API no implementa nada de eso.
FROM nginx:1.27-alpine

# Gateway Offloading (cifrado): certificado autofirmado para la demo.
# En un entorno real sería un certificado emitido por una CA (por ejemplo
# Let's Encrypt) montado como volumen o gestionado aparte.
RUN apk add --no-cache openssl \
  && mkdir -p /etc/nginx/certs \
  && openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
       -keyout /etc/nginx/certs/server.key \
       -out /etc/nginx/certs/server.crt \
       -subj "/CN=localhost" \
  && apk del openssl

# La imagen oficial procesa los templates con envsubst al arrancar: sustituye
# las variables de entorno (GATEKEEPER_API_KEY) y deja el resultado en
# /etc/nginx/conf.d/default.conf.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
