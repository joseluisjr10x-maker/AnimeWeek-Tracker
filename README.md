# AnimeWeek Tracker v95.28.0

Proyecto web y Android nativo basado en Capacitor 7.

## Centro de actualizaciones

La app consulta `latest.json` en la rama `main` del repositorio oficial. Cuando se publica una versión Android, GitHub Actions compila el APK firmado, valida application ID, versionCode y certificado, publica el GitHub Release y actualiza el manifiesto. La aplicación descarga desde GitHub, verifica SHA-256, vuelve a comprobar paquete, versión y certificado instalado y abre el instalador de Android. Android siempre solicita confirmación.

El manifiesto inicial mantiene `android.enabled=false` hasta que se publique la primera APK firmada y verificada. No actives esa bandera manualmente.

## GitHub Actions Secrets

En Settings → Secrets and variables → Actions, configura exactamente estos cuatro secretos:

- `ANDROID_KEYSTORE_BASE64`: el archivo `debug.keystore` de la instalación actual codificado en Base64.
- `ANDROID_STORE_PASSWORD`: contraseña del keystore (en el debug.keystore predeterminado suele ser `android`).
- `ANDROID_KEY_ALIAS`: alias (en el debug.keystore predeterminado suele ser `AndroidDebugKey`).
- `ANDROID_KEY_PASSWORD`: contraseña de la clave (en el debug.keystore predeterminado suele ser `android`).

El flujo obtiene automáticamente la huella SHA-256 del keystore y comprueba que la APK resultante use exactamente ese certificado. No hace falta crear un quinto secreto de huella.

**No subas `debug.keystore`, archivos `.jks`, contraseñas ni el contenido Base64 al repositorio.** El `.gitignore` los excluye.

## Publicar la primera versión con actualizador

1. Sube el contenido completo del proyecto a la rama `main`.
2. Crea y sube el tag `v95.28.0`. Eso ejecuta GitHub Actions y publica la APK inicial.
3. Instala manualmente esa primera APK sobre la instalación existente. El APK actual 2.2 no incluye todavía el Centro de actualizaciones.
4. Para cada nueva versión, aumenta la versión y crea un tag semántico, por ejemplo `v95.29.0`. GitHub Actions compila, firma, valida y publica el APK; la app recibe el manifiesto actualizado.

## Desarrollo local

```bash
npm ci
npm run test:all
npx cap sync android
npx cap open android
```

`android/local.properties`, cachés Gradle, `node_modules`, recursos copiados por Capacitor y claves privadas son locales o generados y no se versionan.

## Identidad Android

- Application ID: `com.animeweek.tracker`
- Versión base: `95.28.0`
- versionCode base: `9528000`

Las actualizaciones firmadas con el mismo certificado y application ID conservan los datos privados de la instalación.
