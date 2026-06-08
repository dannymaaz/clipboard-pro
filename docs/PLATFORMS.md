# Plataformas Soportadas

Clipboard Pro esta preparado para un codigo unico con builds nativos en Windows, macOS y Linux mediante Tauri v2.

## Windows 10 y Windows 11

Formato recomendado:

- `.msi` para instalacion tradicional.
- `.exe` si se habilita NSIS en una fase posterior.

Descargar con PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/download-windows.ps1 -Repository dannymaaz/clipboard-pro
```

Descargar con GitHub CLI:

```powershell
gh release download --repo dannymaaz/clipboard-pro --pattern "*.msi"
```

Instalar:

```powershell
msiexec /i .\Clipboard*Pro*.msi
```

Usar:

- Abrir con `Ctrl + Alt + V`.
- Copiar desde Word, Excel, VSCode, navegadores o cualquier app.
- Seleccionar un elemento para pegarlo en la app activa y ocultar Clipboard Pro.
- Usar el icono de bandeja para mostrar, ocultar o cerrar la app.

## macOS

Formato recomendado:

- `.dmg` para usuarios finales.
- `.app.tar.gz` para distribucion tecnica si se habilita.

Descargar con Terminal:

```bash
sh scripts/download-macos.sh dannymaaz/clipboard-pro
open clipboard-pro-macos.dmg
```

Descargar con GitHub CLI:

```bash
gh release download --repo dannymaaz/clipboard-pro --pattern "*.dmg"
```

Instalar:

- Abrir el `.dmg`.
- Arrastrar `Clipboard Pro` a `Applications`.
- Abrir la app y conceder permisos si macOS los solicita.

Usar:

- Abrir con `Ctrl + Alt + V`.
- El historial se guarda localmente en el directorio de datos de la app.
- Seleccionar un elemento usa `Cmd + V` automaticamente despues de ocultar la ventana.
- Si macOS bloquea el pegado automatico, habilitar `Clipboard Pro` en `System Settings > Privacy & Security > Accessibility`.
- En builds sin firma, revisar `System Settings > Privacy & Security`.

## Linux

Formatos recomendados:

- `.AppImage` para ejecucion portable.
- `.deb` para Debian, Ubuntu y derivados.

Descargar AppImage:

```bash
sh scripts/download-linux.sh dannymaaz/clipboard-pro appimage
chmod +x clipboard-pro-linux.appimage
./clipboard-pro-linux.appimage
```

Descargar `.deb`:

```bash
sh scripts/download-linux.sh dannymaaz/clipboard-pro deb
sudo apt install ./clipboard-pro-linux.deb
clipboard-pro
```

Descargar con GitHub CLI:

```bash
gh release download --repo dannymaaz/clipboard-pro --pattern "*.AppImage"
gh release download --repo dannymaaz/clipboard-pro --pattern "*.deb"
```

Usar:

- Abrir con `Ctrl + Alt + V`.
- En Wayland o escritorios con politicas estrictas, el shortcut global puede depender del compositor.
- En X11, seleccionar un elemento usa `Ctrl + V` automaticamente; en Wayland puede requerir permisos del compositor.
- El historial se mantiene local y sin servicios externos.

## Generar Artefactos

El workflow `.github/workflows/release.yml` compila:

- Windows en `windows-latest`.
- macOS en `macos-latest`.
- Linux en `ubuntu-22.04`.

Publicar:

```bash
git tag v0.1.4
git push origin v0.1.4
```
