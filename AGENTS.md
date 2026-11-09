# Instrucciones para asistentes de IA

Este repo es el TFU de Análisis y Diseño (grupo 6): un recetario en NestJS + PostgreSQL. La tarea en curso es el **TFU 5, Parte 2**: **implementar** la arquitectura orientada a servicios (SOA) diseñada y entregada en la Parte 1.

**El diseño está cerrado.** Es el del documento entregado, y la Parte 2 consiste en implementarlo tal cual. No propongas otra arquitectura, otra partición de servicios ni otros patrones: tu trabajo es escribir el código que cumple ese diseño.

## Dónde está el diseño

1. **[docs/tfu5-parte1-documento.md](docs/tfu5-parte1-documento.md)**: el documento final de la Parte 1 (copia exportada del Google Doc del grupo). Es la **fuente de verdad**. Ante cualquier duda o contradicción, manda este documento.
2. **[docs/tfu5-guia-implementacion.md](docs/tfu5-guia-implementacion.md)**: el mismo diseño traducido a tareas de código (qué módulo va a cada servicio, puertos, protocolos, valores de los patrones y escenarios de prueba). Empezá por acá para implementar.
3. **[docs/diagramas/](docs/diagramas/)**: los diagramas de componentes, despliegue y secuencia del documento.

## Lo que el código tiene que cumplir

Todo esto está en el documento; es la lista corta para no salirse del diseño:

- **Tres servicios NestJS:** `inventario-recetas`, `lista-compras` y `precios`, más un gateway nginx que solo enruta y no tiene lógica de negocio.
- **Producto y Receta en el mismo servicio** (`inventario-recetas`). Cocinar sigue siendo una transacción ACID local; no hay sagas.
- **SOAP con WSDL solo para `consultarDisponibilidad`**, que consume `lista-compras`. Todo lo demás es REST/JSON.
- **En `lista-compras`:** timeout de 2 s, retry con hasta 2 reintentos, Circuit Breaker sobre Precios (se abre con 3 fallos, pasa a semiabierto a los 10 s) y fallback con caché en memoria del último precio conocido. Los precios desactualizados se marcan "no actualizado" y los que nunca se obtuvieron, "no disponible".
- **El stock no se cachea:** si Inventario no responde, se devuelve 503.
- **Los precios faltantes se piden en una sola llamada** (consulta agrupada).
- **Despliegue:** Docker Compose en un único host, un contenedor por servicio. Las URLs entre servicios van en variables de entorno.
- **Pruebas de disponibilidad:** los 4 escenarios del documento, con 100 solicitudes cada uno, midiendo tasa de éxito y tiempo de respuesta (con circuito cerrado, abierto y sin Circuit Breaker).

Si algo de la implementación realmente no se puede hacer como dice el documento, no lo cambies por tu cuenta: explicale el problema al usuario.

## Estado actual del código

`src/` todavía es el monolito de la entrega anterior: un solo proyecto NestJS con los módulos `producto`, `receta`, `api-precios` y `lista-de-compras`, comunicados por interfaces `*.contract.ts`. Ese código es la base que se reparte entre los tres servicios. El README explica ese diseño previo.

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
- Es un trabajo académico y el grupo tiene que poder explicar el código en la defensa: explicá qué hace cada parte y cómo se relaciona con el diseño del documento.
