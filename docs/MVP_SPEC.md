# Especificacion MVP

## Alcance

Clipboard Pro MVP entrega una base lista para desarrollo con:

- Ventana principal compacta.
- Historial de elementos.
- Busqueda instantanea.
- Pineados.
- Favoritos.
- Colecciones.
- Renombrado.
- Edicion de texto.
- Copia al portapapeles del sistema.
- Captura local de texto copiado desde otras aplicaciones.
- Poda automatica configurable.

## Fuera de Alcance del MVP

- Sin sincronizacion cloud.
- Sin cuentas.
- Sin redes sociales.
- Sin compartir.
- Sin analytics.
- Sin gestor documental.

## Flujo de Navegacion

- `Historial`: vista principal y default.
- `Favoritos`: lista filtrada por `is_favorite`.
- `Colecciones`: selector horizontal de colecciones y lista filtrada.
- Dialog inline para crear coleccion, renombrar o editar.

## Criterios de Aceptacion

- La app abre con `Ctrl + Alt + V`.
- El texto copiado desde otras apps entra al historial.
- La busqueda filtra elementos rapidamente.
- Copiar un elemento escribe en el portapapeles del sistema.
- Pineados aparecen arriba.
- Favoritos se muestran en su vista.
- Colecciones evitan duplicados.
- La poda respeta elementos protegidos.
