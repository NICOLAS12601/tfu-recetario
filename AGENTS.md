# Instrucciones para asistentes de IA

Este repo es el TFU de Análisis y Diseño (grupo 6): un recetario en NestJS + PostgreSQL. La tarea en curso es el **TFU 5, Parte 2**: migrar el monolito actual a una arquitectura orientada a servicios (SOA) distribuida.

## Leé esto antes de proponer o escribir código

1. **[docs/tfu5-guia-implementacion.md](docs/tfu5-guia-implementacion.md)** es la guía de la Parte 2. Tiene qué módulo va a cada servicio, puertos, protocolos, valores de los patrones y escenarios de prueba. Es el punto de partida obligatorio.
2. **[docs/diagramas/](docs/diagramas/)**: diagramas de componentes, despliegue y secuencia (PNG). La fuente editable es `tfu5-diagramas.drawio`.
3. La fuente de verdad del diseño es el documento de la Parte 1 del grupo (Google Doc "TFU 5 ANDIS 2"). Si la guía y el Doc no coinciden, manda el Doc: avisale al usuario y actualizá la guía en vez de inventar una tercera versión.

## Decisiones que no hay que cambiar sin consultar al grupo

Estas decisiones están justificadas en el documento entregado y se defienden oralmente. Si una tarea parece requerir cambiarlas, preguntá antes.

- **Tres servicios:** `inventario-recetas`, `lista-compras` y `precios`, más un gateway nginx sin lógica de negocio.
- **Producto y Receta quedan en el mismo servicio** (`inventario-recetas`). Cocinar es una transacción ACID local; no separarlos ni introducir sagas.
- **SOAP/WSDL solo para `consultarDisponibilidad`** (lista-compras → inventario-recetas). Todo lo demás es REST/JSON.
- **Circuit Breaker, retry, timeout y la caché del último precio viven en `lista-compras`**, no en `precios`. El stock nunca se cachea.
- Los precios faltantes se piden **en una sola llamada** (consulta agrupada).
- Despliegue con **Docker Compose en un único host**, un contenedor por servicio. Las URLs entre servicios van en variables de entorno.

## Estado actual del código

`src/` todavía es el monolito de la entrega anterior: un solo proyecto NestJS con los módulos `producto`, `receta`, `api-precios` y `lista-de-compras`, comunicados por interfaces `*.contract.ts`. El README explica ese diseño previo.

## Comandos

```bash
docker compose up -d --build   # API + Postgres (monolito actual), API en :3000
npm run start:dev              # desarrollo con watch (requiere `docker compose up -d db`)
npm run lint                   # oxlint
npm test                       # vitest
npm run test:e2e
```

La colección [docs/postman/tfu-recetario.postman_collection.json](docs/postman/tfu-recetario.postman_collection.json) es la demo de la transacción ACID de cocinar. Sirve para verificar que esa garantía se mantenga después de separar los servicios.

## Convenciones

- Escribí en español (código de dominio, mensajes de error, docs y commits), como el resto del repo.
- Es un trabajo académico: el grupo tiene que poder explicar cada decisión. Explicá el porqué de lo que propongas, no solo el código.
