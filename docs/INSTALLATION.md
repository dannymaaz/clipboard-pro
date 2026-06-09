# Instalacion y Descarga

## Descarga Rapida

Los scripts de macOS y Linux usan `curl` y `node` para encontrar automaticamente el asset mas reciente. Si prefieres no usar scripts, usa GitHub CLI con `gh release download`.

### Windows 10 y Windows 11

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/download-windows.ps1 -Repository dannymaaz/clipboard-pro
```

GitHub CLI:

```powershell
gh release download --repo dannymaaz/clipboard-pro --pattern "*.msi"
```

Instalar:

```powershell
msiexec /i .\Clipboard*Pro*.msi
```

### macOS

Terminal:

```bash
sh scripts/download-macos.sh dannymaaz/clipboard-pro
open clipboard-pro-macos.dmg
```

GitHub CLI:

```bash
gh release download --repo dannymaaz/clipboard-pro --pattern "*.dmg"
```

Instalar:

- Abre el `.dmg`.
- Arrastra `Clipboard Pro` a `Applications`.
- En builds sin firma, revisa `System Settings > Privacy & Security`.

### Linux

AppImage:

```bash
sh scripts/download-linux.sh dannymaaz/clipboard-pro appimage
chmod +x clipboard-pro-linux.appimage
./clipboard-pro-linux.appimage
```

GitHub CLI para AppImage:

```bash
gh release download --repo dannymaaz/clipboard-pro --pattern "*.AppImage"
```

Debian/Ubuntu:

```bash
sh scripts/download-linux.sh dannymaaz/clipboard-pro deb
sudo apt install ./clipboard-pro-linux.deb
clipboard-pro
```

GitHub CLI para `.deb`:

```bash
gh release download --repo dannymaaz/clipboard-pro --pattern "*.deb"
```

## Build Local por Plataforma

### Windows

```powershell
npm ci
npm run tauri:build
```

El instalador queda en `src-tauri/target/release/bundle/msi`.

### macOS

```bash
npm ci
npm run tauri:build
```

Los artefactos quedan en `src-tauri/target/release/bundle/macos` y `src-tauri/target/release/bundle/dmg`.

### Linux

Instala dependencias de Tauri:

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf
npm ci
npm run tauri:build
```

Los artefactos quedan en `src-tauri/target/release/bundle/appimage` y `src-tauri/target/release/bundle/deb`.

## Uso

- Abre Clipboard Pro con `Ctrl + Alt + V`.
- Copia texto desde cualquier aplicacion; se agregara al historial local.
- Busca desde la barra superior.
- Selecciona un elemento para copiarlo, ocultar la ventana y pegarlo en la app activa.
- Usa el menu de tres puntos para pinear, marcar favorito, agregar a coleccion, renombrar, editar o eliminar.
- Ajusta el limite del historial desde el icono de preferencias.
- La app queda en la bandeja del sistema; desde ahi puedes mostrarla, ocultarla o cerrarla.
- Activa o desactiva `Iniciar con el sistema` desde preferencias.
- Las imagenes copiadas se muestran con miniatura real y se pegan como imagen al seleccionarlas.

### Notas por sistema

- Windows: el pegado automatico usa `Ctrl + V` despues de ocultar la ventana.
- macOS: el pegado automatico usa `Cmd + V`; si macOS lo solicita, habilita permisos en `System Settings > Privacy & Security > Accessibility`.
- Linux: en sesiones X11 el pegado automatico usa `Ctrl + V`; en Wayland puede depender de las politicas del compositor.

## Releases en GitHub

Para publicar una version:

```bash
git tag v0.1.8
git push origin v0.1.8
```

GitHub Actions generara una release publica para Windows, macOS y Linux usando `.github/workflows/release.yml`.
