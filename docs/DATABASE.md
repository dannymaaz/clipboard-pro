# Base de Datos SQLite

## Tablas

- `clipboard_items`: elemento principal del portapapeles.
- `collections`: colecciones creadas por el usuario.
- `collection_items`: relacion muchos-a-muchos entre elementos y colecciones.
- `settings`: configuracion local.
- `item_search`: indice FTS5 para busqueda instantanea.

## Indices

- `idx_clipboard_items_created_at`: historial reciente.
- `idx_clipboard_items_pinned`: orden de pineados.
- `idx_clipboard_items_favorite`: vista de favoritos.
- `idx_clipboard_items_kind`: filtros por tipo.
- `idx_collection_items_collection`: elementos por coleccion.
- `idx_collection_items_item`: colecciones por elemento.

## Rendimiento

SQLite se configura con:

- `WAL`: escrituras y lecturas concurrentes mas fluidas.
- `synchronous = NORMAL`: balance entre seguridad y velocidad.
- `foreign_keys = ON`: integridad referencial.
- `temp_store = MEMORY`: operaciones temporales mas rapidas.

## Poda del Historial

Cuando el limite configurado se supera, se eliminan los elementos mas antiguos que cumplen:

- No estan pineados.
- No son favoritos.
- No pertenecen a ninguna coleccion.

Esta regla conserva informacion intencional y elimina solo historial descartable.
