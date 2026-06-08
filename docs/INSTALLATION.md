# Instalacion y Descarga

## Descarga Rapida

Reemplaza `OWNER/clipboard-pro` por el repositorio real cuando el proyecto este publicado.

Los scripts de macOS y Linux usan `curl` y `node` para encontrar automaticamente el asset mas reciente. Si prefieres no usar scripts, usa GitHub CLI con `gh release download`.

### Windows 10 y Windows 11

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/download-windows.ps1 -Repository OWNER/clipboard-pro
```

GitHub CLI:

```powershell
gh release download --repo OWNER/clipboard-pro --pattern "*.msi"
```

Instalar:

```powershell
msiexec /i .\Clipboard*Pro*.msi
```

### macOS

Terminal:

```bash
sh scripts/download-macos.sh OWNER/clipboard-pro
open clipboard-pro-macos.dmg
```

GitHub CLI:

```bash
gh release download --repo OWNER/clipboard-pro --pattern "*.dmg"
```

Instalar:

- Abre el `.dmg`.
- Arrastra `Clipboard Pro` a `Applications`.
- En builds sin firma, revisa `System Settings > Privacy & Security`.

### Linux

AppImage:

```bash
sh scripts/download-linux.sh OWNER/clipboard-pro appimage
chmod +x clipboard-pro-linux.appimage
./clipboard-pro-linux.appimage
```

GitHub CLI para AppImage:

```bash
gh release download --repo OWNER/clipboard-pro --pattern "*.AppImage"
```

Debian/Ubuntu:

```bash
sh scripts/download-linux.sh OWNER/clipboard-pro deb
sudo apt install ./clipboard-pro-linux.deb
clipboard-pro
```

GitHub CLI para `.deb`:

```bash
gh release download --repo OWNER/clipboard-pro --pattern "*.deb"
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
- Selecciona un elemento para copiarlo al portapapeles activo.
- Usa el menu de tres puntos para pinear, marcar favorito, agregar a coleccion, renombrar, editar o eliminar.
- Ajusta el limite del historial desde el icono de preferencias.

## Releases en GitHub

Para publicar una version:

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions generara releases draft para Windows, macOS y Linux usando `.github/workflows/release.yml`.
