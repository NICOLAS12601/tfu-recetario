# TFU 5 — Guía de implementación (Parte 2)

Esta guía traduce a código el diseño final de la Parte 1, para que cualquiera del grupo pueda implementar la Parte 2 sin reconstruir el contexto. El diseño está cerrado: es el del documento entregado, copiado en [tfu5-parte1-documento.md](tfu5-parte1-documento.md). Si algo de esta guía contradice al documento, manda el documento y hay que corregir la guía.

Los diagramas están en [docs/diagramas/](diagramas/): `componentes.png`, `despliegue.png` y `secuencia.png`. La fuente editable de los tres es [tfu5-diagramas.drawio](diagramas/tfu5-diagramas.drawio), con una página por diagrama; se abre en [app.diagrams.net](https://app.diagrams.net).

## Qué pide la consigna para la Parte 2

- Implementar la solución de forma distribuida (cada servicio en su propio proceso).
- Migrar una operación de REST a SOAP con WSDL, y que la consuma otro componente.
- Aplicar al menos un patrón para mitigar las falacias de la computación distribuida.
- Probar el atributo de calidad elegido (disponibilidad).
- Desplegar con Docker.

## De dónde partimos

El código actual es el monolito de la entrega anterior: un solo proyecto NestJS con cuatro módulos en `src/` (`producto`, `receta`, `api-precios`, `lista-de-compras`), que se comunican con llamadas internas a través de las interfaces `*.contract.ts`. Se levanta con `docker compose up` (servicio `api` + `db`).

## Arquitectura objetivo

Son tres servicios NestJS, más un gateway y la base de datos, todos como contenedores en un mismo `docker-compose.yml`.

| Contenedor | Sale de (módulos actuales) | Puerto | Expone | Accede a la BD |
|---|---|---|---|---|
| `gateway` (nginx) | nuevo | 443 o 80 hacia afuera | Enruta `/listas` a lista-compras, y `/productos` y `/recetas` a inventario-recetas. No tiene lógica de negocio. | No |
| `inventario-recetas` | `producto` + `receta` | 8081 | REST de productos y recetas (incluye cocinar) + **SOAP** `consultarDisponibilidad` en `/ws` (WSDL en `/ws?wsdl`) | Sí, es el único |
| `lista-compras` | `lista-de-compras` | 8080 | REST `POST /listas` | No |
| `precios` | `api-precios` | 8082 | REST de consulta de precios (simula un proveedor externo) | No |
| `postgres` | `db` actual | 5432 (interno) | — | — |

**Por qué Producto y Receta van juntos:** cocinar una receta descuenta stock de varios productos en una sola transacción ACID. Si se separaran, esa transacción pasaría a ser distribuida (sagas, consistencia eventual). Por eso la transacción de cocinar se queda tal como está en el monolito.

## Comunicación entre servicios

| Origen → destino | Protocolo | Operación | Patrones |
|---|---|---|---|
| lista-compras → inventario-recetas | **SOAP/XML con WSDL** | `consultarDisponibilidad(recetaId)` → lista de ingredientes faltantes (`productoId`, `nombre`, `cantidadFaltante`) | timeout + retry; si sigue fallando, responde **503** con un mensaje claro |
| lista-compras → precios | REST/JSON | Precios de **todos** los faltantes **en una sola llamada** (consulta agrupada, no una por ingrediente) | timeout + retry + **Circuit Breaker** + fallback a caché |

Las URLs de los otros servicios tienen que venir de variables de entorno (por ejemplo `INVENTARIO_SOAP_URL` y `PRECIOS_URL`), no escritas en el código. Así, mover un servicio a otra máquina es cambiar configuración, no código.

## Patrones en lista-compras (lo central de la Parte 2)

Los valores son los que figuran en el Doc; si se cambian, hay que cambiarlos también ahí.

- **Timeout:** 2 segundos por llamada remota. Una llamada que pasa el timeout cuenta como fallo para el Circuit Breaker.
- **Retry:** hasta 2 reintentos (3 intentos en total) con espera creciente, y solo ante fallos transitorios.
- **Circuit Breaker sobre Precios:**
  - Cerrado → abierto: después de 3 fallos consecutivos.
  - Abierto → semiabierto: a los 10 segundos.
  - Semiabierto: deja pasar una llamada de prueba. Si sale bien vuelve a cerrado; si falla, vuelve a abierto.
- **Caché del último precio conocido:**
  - Vive en memoria **dentro de lista-compras**, no en Precios. Si estuviera en Precios, se caería junto con él.
  - Se actualiza cada vez que Precios responde bien.
  - Cuando el circuito está abierto o la llamada falla, la lista se arma con el último precio guardado, marcado como "no actualizado". Si nunca se obtuvo un precio para ese producto, se marca como "no disponible".
- **El stock no se cachea:** si Inventario no responde, no hay lista posible y se devuelve 503.

Para las pruebas conviene poder **desactivar el Circuit Breaker** con una variable de entorno (por ejemplo `CB_ENABLED=false`), así se puede medir el tiempo de respuesta "solo con timeout" contra "con Circuit Breaker", como promete el Doc.

## Pruebas de disponibilidad

Condiciones: todo levantado con Docker Compose en un mismo equipo. Para simular fallos se detienen contenedores con `docker stop`. Un script envía **100 solicitudes** y registra el código de respuesta y el tiempo de cada una.

| # | Escenario | Acción | Resultado esperado |
|---|---|---|---|
| 1 | Línea base | Todo activo; se generan listas | 100% de éxito con precios actuales |
| 2 | Cae Precios | `docker stop precios`; se generan listas | Éxito, con precios de caché marcados "no actualizado" |
| 3 | Cae Lista de Compras | `docker stop lista-compras`; se cocina una receta | Cocinar sigue funcionando (vía gateway → inventario-recetas) |
| 4 | Recuperación | `docker start precios` | El circuito pasa a semiabierto y luego a cerrado; vuelven los precios actuales sin intervención manual |

Métricas a reportar:
- Tasa de éxito por escenario.
- Tiempo de respuesta con el circuito cerrado, con el circuito abierto y sin Circuit Breaker.

Se espera que la latencia de la línea base sea mayor que en el monolito: es un costo asumido de la distribución y hay que mencionarlo en los resultados.

## Pendientes / a decidir al implementar

- Estructura del repo para los tres servicios: un monorepo NestJS o una carpeta por servicio.
- Librería para SOAP en NestJS (por ejemplo, el paquete `soap` de npm) y para el Circuit Breaker (por ejemplo, `opossum`), o implementación propia.
- Formato exacto del endpoint de consulta agrupada de precios.
- El script de carga para las pruebas.
