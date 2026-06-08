# Arquitectura de Clipboard Pro

## Principios

- Local-first: todos los datos viven en SQLite local.
- Privacidad primero: no hay telemetria, analytics, sync ni servicios externos.
- Rapidez visible: la ventana debe sentirse como un portapapeles nativo mejorado.
- Complejidad contenida: cada funcionalidad debe justificar su coste cognitivo.
- Codigo unico: React + Tauri + Rust para Windows, macOS y Linux.

## Capas

Frontend:

- `components`: piezas reutilizables de UI.
- `pages`: composicion de pantallas.
- `store`: estado con Zustand.
- `services`: puente entre React y comandos Tauri.
- `types`: contratos TypeScript.
- `utils`: formato, deteccion visual y helpers puros.

Backend:

- `domain`: modelos de negocio puros.
- `application`: comandos Tauri, validacion de casos de uso y orquestacion.
- `database`: repositorio SQLite, migraciones y consultas optimizadas.
- `infrastructure`: integraciones de sistema como portapapeles, shortcuts y ventanas.

## Flujo Principal

1. El usuario presiona `Ctrl + Alt + V`.
2. Tauri enfoca o muestra la ventana principal.
3. React carga historial, colecciones y settings con comandos Tauri.
4. El usuario busca, filtra o selecciona un elemento.
5. Rust copia el contenido al portapapeles del sistema.
6. SQLite actualiza `last_used_at` sin bloquear la interfaz.

## Reglas de Dominio

- Los pineados siempre aparecen arriba.
- Los pineados no tienen vista independiente.
- Los favoritos tienen vista independiente.
- Un elemento puede estar en varias colecciones.
- Un elemento no puede repetirse dentro de la misma coleccion.
- La poda automatica nunca elimina pineados, favoritos ni elementos en colecciones.
- Solo los elementos de texto y URL se pueden editar como texto.

## Inyeccion de Dependencias

La app registra `AppState` en Tauri con el repositorio SQLite. Los comandos reciben `State<AppState>`, lo que permite sustituir la persistencia por un repositorio mock en pruebas futuras sin cambiar la UI.

## Estructura Generada

```text
src/
  assets/
  components/
  features/
  hooks/
  pages/
  services/
  store/
  types/
  utils/
src-tauri/
  capabilities/
  database/
  src/
    application/
    database/
    domain/
    infrastructure/
docs/
tests/
public/
```
