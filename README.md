# TFU Recetario — Soluciones Arquitectónicas

API REST que integra un recetario con una cocina real: no es solo un catálogo de recetas, sino el sistema que sabe qué productos tenés en stock, qué podés cocinar con lo que tenés, qué te falta si no alcanza, y —a través de una API de precios simulada— una idea de cuánto te saldría completar lo que te falta.

## Índice

1. [Modelo de componentes](#1-modelo-de-componentes)
2. [Proceso para encontrar los componentes](#2-proceso-para-encontrar-los-componentes)
3. [Justificación del tipo de partición](#3-justificación-del-tipo-de-partición)
4. [Contenedores vs VMs](#4-contenedores-vs-vms)
5. [ACID vs BASE](#5-acid-vs-base)
6. [Cómo correr el proyecto](#6-cómo-correr-el-proyecto)
7. [Patrones de arquitectura aplicados](#7-patrones-de-arquitectura-aplicados)

---

## 1. Modelo de componentes

El sistema está armado en cuatro componentes, cada uno implementado como un módulo de NestJS (`ProductoModule`, `RecetaModule`, `ApiPreciosModule`, `ListaDeComprasModule` en `src/`). Cada componente expone lo que hace hacia afuera a través de una interfaz de TypeScript explícita (un archivo `*.contract.ts`) que su service implementa; eso es lo que en el diagrama UML se dibuja como la interfaz provista de cada uno.

El diagrama UML de clases/componentes está en [docs/recetario.drawio.xml](docs/recetario.drawio.xml). Para verlo/editarlo: abrilo en [app.diagrams.net](https://app.diagrams.net) (File → Open from → Device) o con la extensión "Draw.io Integration" de VS Code, que lo renderiza directo en el editor sin salir del repo.

- **Producto** (interfaz provista: `IProductoStock`, en [src/producto/producto.contract.ts](src/producto/producto.contract.ts)) es el dueño del stock de cada ingrediente. Es el único componente que sabe leer y modificar stock; ningún otro componente toca la tabla de productos directamente. No depende de ningún otro componente del sistema.
- **Receta** (interfaz provista: `IRecetaConsulta`, en [src/receta/receta.contract.ts](src/receta/receta.contract.ts)) sabe qué productos y en qué cantidad necesita cada plato. Para descontar stock al cocinar, **consume** la interfaz de Producto en vez de tocar el stock por su cuenta.
- **Api Precios** (interfaz provista: `IPrecioProvider`, en [src/api-precios/api-precios.contract.ts](src/api-precios/api-precios.contract.ts)) da el precio de un producto. Simula una integración externa: no tiene tabla propia, no depende de nadie del sistema.
- **Lista de Compras** no expone interfaz propia porque es el borde de la aplicación: nadie más lo consume a él. **Consume** tanto la interfaz de Receta (para saber qué falta) como la de Api Precios (para tasarlo), y combina ambas respuestas en un pedido.

Producto es el componente con menor acoplamiento saliente (no consume a nadie, todos lo consumen a él) y esa es justamente la señal de que quedó bien recortado: es una responsabilidad de negocio autocontenida.

## 2. Proceso para encontrar los componentes

Se partió de la consigna, que ya da tres módulos de alto nivel: productos, recetas, listas de compra. A partir de ahí:

1. **Brainstorm libre de candidatos**, mezclando módulos y operaciones sin filtrar todavía: Receta, Producto, Cocinar, Lista de Compras, Precios/Supermercado, y un posible Orquestador central.
2. **Depurar por responsabilidad**: por cada candidato, preguntar si merece una interfaz propia o si en realidad es una operación que vive dentro de otro componente.
   - *Cocinar* se descartó: no tenía ninguna responsabilidad que Receta y Producto no cubrieran ya (Receta sabe qué se necesita, Producto sabe descontar su propio stock).
   - El *Orquestador* central se descartó: Lista de Compras ya cumple ese rol para el único flujo que lo necesita; agregar una capa más no sumaba nada.
3. **Analizar roles y responsabilidades por descarte**, verificando cada nombre contra la pregunta "¿qué sabe hacer *solo* este componente?":
   - Lista de Compras no sabe cocinar, solo arma listas de lo que falta.
   - Producto solo sabe de sí mismo (su propio stock), no de combinaciones de productos.
   - Api Precios no tiene idea de qué es una receta.
   - Receta es la única que conoce la relación "esta receta necesita estos productos en estas cantidades" — por eso es quien dispara el consumo de stock (a través de la interfaz de Producto), y no al revés.
4. **Trazar las dependencias** entre lo que sobrevivió al descarte, confirmando que cierran en un grafo sin ciclos (Producto ← Receta ← Lista de Compras → Api Precios).

## 3. Justificación del tipo de partición

**Partición de primer nivel: por dominio** (no técnica).

Los dos criterios posibles eran partición técnica (capas: Presentación / Lógica / Persistencia, sin importar el negocio) o partición por dominio (capacidades de negocio, en la línea de DDD). Acá se usó dominio porque las fronteras entre componentes se trazaron por **qué capacidad de negocio cubre cada uno** —gestionar ingredientes, saber qué se puede cocinar, consultar precios, armar una lista de compras— y no por capas técnicas dentro de una misma capacidad.

Que todo el proyecto sea backend (sin frontend) no define el tipo de partición: con el mismo backend, sin ninguna UI, también se podría haber particionado en Presentación/Lógica/Persistencia como capas dentro del propio backend, y eso seguiría siendo partición técnica. Lo que decide el tipo es el primer criterio usado para trazar las fronteras, y acá ese criterio fue "¿qué necesito que cambie de forma independiente?": el stock de productos, las reglas de una receta y el precio de un producto son reglas de negocio que evolucionan por separado, no capas de una misma pila.

## 4. Contenedores vs VMs

**Elegido: contenedores (Docker).**

Una máquina virtual virtualiza hardware y necesita un sistema operativo completo propio por cada instancia: arranca en minutos, carga un kernel entero y duplica el overhead de memoria y disco de cada SO. Un contenedor, en cambio, comparte el kernel del host y aísla solo el proceso y su filesystem: arranca en segundos y el overhead de recursos es mínimo porque no hay un SO de más corriendo por cada pieza.

Para esta app (una API sin estado + una base de datos) no hace falta el aislamiento a nivel de sistema operativo que dan las VMs — no hay necesidad de aislar kernels distintos ni de correr sistemas operativos diferentes entre sí. El costo de instalar y mantener un SO completo por cada componente no se justifica frente al problema que hay que resolver. Docker alcanza para aislar la API de la base de datos, es liviano para levantar en desarrollo (`docker compose up`) y el mismo artefacto (la imagen) es el que se llevaría a producción, sin tener que mantener una imagen de VM aparte.

## 5. ACID vs BASE

**Elegido: ACID**, para la operación de consumir stock.

El caso de uso es el de manual: `Producto.consumirStock()` descuenta stock y **no puede dejarlo negativo**. Si dos requests concurrentes leen `stock = 1` al mismo tiempo, ambas pueden creer que alcanza y las dos descuentan → condición de carrera clásica → el stock termina en `-1`. Eso es inaceptable acá: el stock es la fuente de verdad de "hay o no hay" ese ingrediente, no un dato que pueda quedar temporalmente inconsistente entre réplicas (que es justamente lo que BASE tolera a cambio de más disponibilidad/escala).

Implementación concreta, en [src/producto/producto.service.ts](src/producto/producto.service.ts):

- Cada consumo de stock corre dentro de una **transacción** con **lock pesimista** (`SELECT ... FOR UPDATE`) sobre la fila del producto, así una segunda transacción concurrente espera a que la primera termine en vez de leer un stock ya obsoleto.
- Si no alcanza el stock, la transacción se aborta (`rollback`) y no se descuenta nada — eso es la **A** de Atomicidad.

Un paso más allá, en [src/receta/receta.service.ts](src/receta/receta.service.ts): como una receta puede tener varios ingredientes, `Receta.cocinar()` descuenta el stock de **todos** los ingredientes dentro de **una sola transacción** — si falta uno solo, no se descuenta ninguno. Por eso no alcanza con llamar `consumirStock()` (que abre su propia transacción) ingrediente por ingrediente; existe una variante `consumirStockEnTransaccion()` que recibe el `EntityManager` de una transacción ya abierta para participar en ella en vez de abrir la suya propia. Los productos se lockean ordenados por id para que dos "cocinar" concurrentes con ingredientes en común no se deadlockeen entre sí.

BASE (consistencia eventual) hubiera sido razonable para algo como el precio de Api Precios —no pasa nada grave si por un segundo dos clientes ven un precio levemente desactualizado—, pero no para el stock, que es justamente el dato que la app tiene que garantizar correcto en todo momento.

## 6. Cómo correr el proyecto

**Todo en Docker** (gateway + API + Postgres; requiere solo Docker):

```bash
docker compose up -d --build   # build de la imagen del gateway y de la api + levanta db, api y gateway
# Único punto de entrada: https://localhost  (certificado autofirmado)
```

La API y la base de datos **no publican puertos**: solo el gateway los expone.
Todo el tráfico entra por el gatekeeper, que exige el header `X-Api-Key`:

```bash
curl -k -H 'X-Api-Key: clave-de-demo' https://localhost/productos
```

La clave se define con `GATEKEEPER_API_KEY` (ver `.env.example`; por defecto
`clave-de-demo`).

**Desarrollo local con watch** (requiere Node 22+; recompila solo al guardar).
Como la API y la base no publican puertos por defecto, se usa un override que
solo los expone para desarrollo:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db   # Postgres con el puerto publicado (solo dev)
cp .env.example .env        # (ya existe, ver valores por defecto)
npm install
npm run start:dev           # API en http://localhost:3000 (sin gateway)
```

Endpoints (a través del gateway requieren el header `X-Api-Key`):

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/productos` | Crea un producto (`{ nombre, stock }`) |
| GET | `/productos` | Lista productos |
| GET | `/productos/:id` | Un producto puntual |
| PATCH | `/productos/:id/consumir-stock` | Descuenta stock (`{ cantidad }`), falla con 409 si no alcanza |
| PATCH | `/productos/:id/reponer-stock` | Suma stock (`{ cantidad }`) |
| POST | `/recetas` | Crea una receta (`{ nombre, ingredientes: [{ productoId, cantidad }] }`) |
| GET | `/recetas` | Lista todas las recetas, con sus ingredientes |
| GET | `/recetas/:id` | Una receta puntual, con sus ingredientes |
| GET | `/recetas/:id/detalle` | La receta con TODOS sus ingredientes, cada uno marcado con cuánto se necesita, cuánto hay y cuánto falta |
| GET | `/recetas/:id/disponibilidad` | Solo lo que falta para poder cocinarla |
| POST | `/recetas/:id/cocinar` | Descuenta el stock de todos los ingredientes en una sola transacción |
| GET | `/lista-de-compras/receta/:recetaId` | Lista de compras (con precios) de lo que falta para esa receta |
| POST | `/lista-de-compras` | Lista de compras combinada para varias recetas (`{ recetaIds: [...] }`) |
| POST | `/lista-de-compras/solicitudes` | Encola la lista (asincrónico): responde 202 con `Location` para consultar el resultado |
| GET | `/lista-de-compras/solicitudes/:id` | Consulta el estado/resultado de una solicitud encolada |
| GET | `/configuracion` | Parámetros de configuración vigentes |
| PATCH | `/configuracion/:clave` | Cambia un parámetro de configuración (`{ valor }`) |

## 7. Patrones de arquitectura aplicados

Además de la partición en componentes, el sistema aplica patrones de varias
categorías. Los de disponibilidad, rendimiento y configuración viven en el
código de la API; los de seguridad, en el contenedor de entrada.

### Disponibilidad
- **Retry** ([src/lista-de-compras/reintentar.ts](src/lista-de-compras/reintentar.ts)):
  ante una falla transitoria del proveedor de precios, reintenta la cantidad de
  intentos configurada antes de darse por vencido.
- **Rate limit** ([src/limitar-solicitudes.ts](src/limitar-solicitudes.ts)):
  limita la cantidad de solicitudes por cliente en una ventana de tiempo; al
  superarla responde 429.

### Rendimiento
- **Cache-aside** ([src/lista-de-compras/cache-precios.ts](src/lista-de-compras/cache-precios.ts)):
  consulta una caché de precios antes de ir al proveedor y guarda el resultado
  cuando falta.
- **Asynchronous request-reply**
  ([src/lista-de-compras/lista-de-compras.controller.ts](src/lista-de-compras/lista-de-compras.controller.ts)):
  `POST /lista-de-compras/solicitudes` responde 202 con la ubicación del
  resultado y el cliente lo consulta después con `GET`.

### Seguridad
- **Gatekeeper** ([gateway/](gateway)): el gateway es el único punto de entrada.
  Exige una API key (`X-Api-Key`) y rechaza rutas, métodos y tamaños de cuerpo
  no previstos. La API y la base de datos dejan de publicar puertos.
- **Gateway offloading** ([gateway/](gateway)): el mismo contenedor de entrada
  se hace cargo del cifrado (TLS), la compresión (gzip) y el registro de acceso.
  La API no implementa ninguna de esas tres cosas.

### Modificación y despliegue
- **External configuration store**
  ([src/configuracion/](src/configuracion)): los parámetros de los patrones
  anteriores (intentos y espera del retry, límite del rate limit, expiración de
  la caché y probabilidad de falla simulada de precios) viven en la tabla
  `configuracion`. La API mantiene una copia local que refresca cada pocos
  segundos, y se pueden cambiar en caliente por `PATCH /configuracion/:clave`
  (o por SQL) sin recompilar ni reiniciar.
