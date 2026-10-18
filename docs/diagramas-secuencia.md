# Diagramas de secuencia — aplicación de los patrones

Diagramas de secuencia que muestran la aplicación de los
patrones de disponibilidad y de rendimiento. Los diagramas estructurales
(clases de dominio, clases de infraestructura, componentes y despliegue) están
en [`recetario.drawio.xml`](recetario.drawio.xml).

## Retry (disponibilidad)

```mermaid
sequenceDiagram
    participant C as Cliente
    participant S as ListaDeComprasService
    participant P as ApiPreciosService
    C->>S: generar(recetaIds)
    loop hasta retry_intentos (espera retry_espera_ms)
        S->>P: obtenerPrecio(nombre)
        alt falla transitoria
            P-->>S: 503
        else ok
            P-->>S: precio
        end
    end
    Note over S: si agota los intentos, propaga el error
    S-->>C: ListaDeCompras
```

## Cache-aside (rendimiento)

```mermaid
sequenceDiagram
    participant C as Cliente
    participant S as ListaDeComprasService
    participant K as cache-precios
    participant P as ApiPreciosService
    C->>S: generar(recetaIds)
    S->>K: leerPrecioCacheado(nombre)
    alt cache hit
        K-->>S: precio
    else cache miss
        K-->>S: (no está)
        S->>P: obtenerPrecio(nombre)
        P-->>S: precio
        S->>K: guardarPrecioEnCache(nombre, precio, cache_expiracion_ms)
    end
    S-->>C: ListaDeCompras
```

## Asynchronous request-reply (rendimiento)

```mermaid
sequenceDiagram
    participant C as Cliente
    participant Ctrl as ListaDeComprasController
    participant S as ListaDeComprasService
    C->>Ctrl: POST /lista-de-compras/solicitudes
    Ctrl->>Ctrl: guardar {estado: "pendiente"}
    Ctrl->>S: generar(recetaIds) (sin bloquear)
    Ctrl-->>C: 202 Accepted + Location + Retry-After: 1
    loop polling
        C->>Ctrl: GET /lista-de-compras/solicitudes/:id
        alt pendiente
            Ctrl-->>C: 202
        else terminada
            Ctrl-->>C: 200 {estado: "terminada", lista}
        end
    end
```

## Rate limit (disponibilidad)

```mermaid
sequenceDiagram
    participant C as Cliente
    participant M as Middleware rate limit
    participant Cfg as ConfiguracionService
    participant Ctrl as Controller
    C->>M: GET /productos
    M->>Cfg: getNumero(rate_limit_por_minuto)
    alt dentro del límite
        M->>Ctrl: next()
        Ctrl-->>C: 200
    else excedido
        M-->>C: 429 Demasiadas solicitudes
    end
    Note over M: ventana de 60 s por cliente · /configuracion excluido
```

## Gatekeeper (seguridad)

Complementa al diagrama de despliegue: muestra el orden de los filtros en el borde.

```mermaid
sequenceDiagram
    participant C as Cliente
    participant G as Gateway (nginx)
    participant A as API
    C->>G: request
    alt sin X-Api-Key
        G-->>C: 401
    else ruta no prevista
        G-->>C: 404
    else método no previsto
        G-->>C: 405
    else cuerpo > 10k
        G-->>C: 413
    else válido
        G->>A: proxy_pass
        A-->>G: respuesta
        G-->>C: respuesta
    end
```
