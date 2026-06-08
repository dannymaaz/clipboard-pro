# Estrategia de Rendimiento

## Objetivos

- RAM menor a 50 MB.
- CPU menor al 1% en reposo.
- Inicio menor a 1 segundo.
- Respuesta de busqueda percibida menor a 50 ms en datasets normales.

## Decisiones

- Tauri en lugar de Electron.
- Rust para persistencia y operaciones de sistema.
- SQLite local con WAL.
- FTS5 para busqueda.
- Zustand para estado minimo.
- Lista virtualizada sin dependencia pesada.
- Sin telemetry SDKs ni procesos externos.
- Monitor del portapapeles con polling conservador de `1200 ms`.

## Riesgos

- Captura continua del portapapeles puede elevar CPU si se reduce demasiado el intervalo.
- Imagenes grandes pueden romper el objetivo de memoria si se guardan sin estrategia de thumbnails.
- Animaciones excesivas afectan equipos modestos.

## Mitigaciones

- Polling adaptativo o listener nativo por plataforma en fases posteriores.
- Guardar metadatos y thumbnails optimizados para imagenes.
- Usar `prefers-reduced-motion`.
- Mantener operaciones SQLite transaccionales y cortas.
- Cargar solo lo visible en pantalla.
