# Publicar con GitHub Actions

Este proyecto esta preparado para generar instaladores de Windows, macOS y Linux en GitHub Actions, sin instalar Visual Studio Build Tools en tu PC.

## 1. Crear el repositorio

En GitHub crea un repositorio, por ejemplo:

```text
clipboard-pro
```

## 2. Subir el codigo

Desde esta carpeta:

```bash
git init
git add .
git commit -m "Initial Clipboard Pro MVP"
git branch -M main
git remote add origin https://github.com/dannymaaz/clipboard-pro.git
git push -u origin main
```

El repositorio publico del proyecto es `dannymaaz/clipboard-pro`.

## 3. Crear una version

```bash
git tag v0.1.8
git push origin v0.1.8
```

GitHub ejecutara `.github/workflows/release.yml` y creara una release publica con artefactos para:

- Windows: `.exe` y `.msi`
- macOS: `.dmg` para Apple Silicon e Intel
- Linux: `.AppImage` y `.deb`

## 4. Descargar instaladores

Windows:

```powershell
gh release download --repo dannymaaz/clipboard-pro --pattern "*.msi"
gh release download --repo dannymaaz/clipboard-pro --pattern "*.exe"
```

macOS:

```bash
gh release download --repo dannymaaz/clipboard-pro --pattern "*.dmg"
```

Linux:

```bash
gh release download --repo dannymaaz/clipboard-pro --pattern "*.AppImage"
gh release download --repo dannymaaz/clipboard-pro --pattern "*.deb"
```

## 5. Revisar el release

El workflow crea el release publico automaticamente para que los usuarios puedan descargar los instaladores.

En GitHub:

1. Abre `Releases`.
2. Entra al release creado por GitHub Actions.
3. Verifica que esten los instaladores.
4. Pulsa `Publish release`.

## Validacion Local Ligera

Estos comandos no requieren Visual Studio Build Tools:

```bash
npm run lint
npm run build
cargo metadata --manifest-path src-tauri/Cargo.toml --no-deps --format-version 1
```

El build desktop completo se hace en GitHub Actions.
