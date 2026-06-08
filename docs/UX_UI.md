# UX/UI

## Direccion Visual

Clipboard Pro debe sentirse como una evolucion natural del portapapeles del sistema:

- Ventana compacta de aproximadamente `420 x 620`.
- Busqueda arriba, sin navegacion pesada.
- Acciones rapidas por elemento.
- Secciones visuales discretas.
- Pineados integrados arriba del historial, sin pantalla separada.

## Inspiracion

- Windows Clipboard `Win + V`.
- Raycast.
- Spotlight.
- Fluent Design.
- Windows 11.

## Temas

- Claro.
- Oscuro.
- Sistema.
- Transparencia y blur.
- Mica/Acrylic en Windows cuando el runtime lo permita.
- Adaptacion visual en macOS y Linux mediante transparencia y colores del sistema.

## Componentes Clave

- `SearchBar`: busqueda inmediata.
- `ViewTabs`: historial, favoritos y colecciones.
- `ClipboardItemRow`: fila compacta con indicador de tipo y acciones.
- `VirtualList`: scroll eficiente para miles de registros.
- `InlineDialog`: renombrado, edicion de texto y creacion de colecciones.

## Accesibilidad

Siguientes pasos:

- Navegacion por teclado con flechas.
- `Enter` para copiar.
- `Esc` para cerrar.
- Roles ARIA para menus y dialogs.
- Estados focus visibles.
