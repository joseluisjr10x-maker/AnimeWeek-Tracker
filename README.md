# AnimeWeek Tracker v95.29.0

Proyecto web y Android nativo basado en Capacitor 7.

## Centro de actualizaciones

La app consulta `latest.json` en la rama `main` del repositorio oficial. Cuando se publica una versión Android, GitHub Actions compila el APK firmado, valida application ID, versionCode y certificado, publica el GitHub Release y actualiza el manifiesto. La aplicación descarga desde GitHub, verifica SHA-256, vuelve a comprobar paquete, versión y certificado instalado y abre el instalador de Android. Android siempre solicita confirmación.

El manifiesto publicado sigue apuntando a la última versión estable hasta que se cree un Release firmado. La bandera `android.enabled` solo se activa mediante el workflow de publicación después de validar el APK.

## GitHub Actions Secrets

En Settings → Secrets and variables → Actions, configura exactamente estos cuatro secretos:

- `ANDROID_KEYSTORE_BASE64`: el archivo `debug.keystore` de la instalación actual codificado en Base64.
- `ANDROID_STORE_PASSWORD`: contraseña del keystore (en el debug.keystore predeterminado suele ser `android`).
- `ANDROID_KEY_ALIAS`: alias (en el debug.keystore predeterminado suele ser `AndroidDebugKey`).
- `ANDROID_KEY_PASSWORD`: contraseña de la clave (en el debug.keystore predeterminado suele ser `android`).

El flujo obtiene automáticamente la huella SHA-256 del keystore y comprueba que la APK resultante use exactamente ese certificado. No hace falta crear un quinto secreto de huella.

**No subas `debug.keystore`, archivos `.jks`, contraseñas ni el contenido Base64 al repositorio.** El `.gitignore` los excluye.

## Probar la compilación inicial (sin publicar)

1. En GitHub abre Actions → Build and publish AnimeWeek Android update.
2. Pulsa Run workflow, deja la rama `main` y escribe `95.29.0` en Version name.
3. Esta ejecución manual compila y firma la APK, valida el application ID, versionCode y SHA-256 del certificado, y guarda el APK como artefacto temporal de Actions durante 14 días. **No crea un Release ni activa las actualizaciones dentro de la app.**
4. Comprueba que la ejecución termine correctamente y descarga el artefacto para revisar la APK.

## Publicar la primera versión con actualizador

1. Después de validar el artefacto, crea y sube el tag `v95.29.0`. El evento de tag ejecuta el mismo build y publica la APK como GitHub Release.
2. El workflow verifica de nuevo la firma de la APK antes de publicarla y actualiza `latest.json` con la URL y SHA-256.
3. Instala manualmente esa primera APK sobre la instalación existente. El APK actual 2.2 no incluye todavía el Centro de actualizaciones.
4. Para cada nueva versión, aumenta la versión y crea un tag semántico, por ejemplo `v95.29.0`. GitHub Actions compila, firma, valida y publica el APK; la app recibe el manifiesto actualizado.

## Cambios de v95.29.0

- El puente de respaldo Android ahora confirma al frontend el resultado del guardado SAF; la copia solo se marca como exitosa después de cerrar el archivo.
- La cabecera móvil centra el título, reduce el espacio vertical y alinea los controles superiores.
- Los adornos festivos se distribuyen como una capa ambiental detrás del contenido.
- Los logos del encabezado, favicon/PWA y el icono de lanzamiento nativo cambian según el tema. Android utiliza aliases de launcher; el sistema puede tardar unos instantes en refrescar su caché visual.

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
- Versión base: `95.29.0`
- versionCode base: `9529000`

Las actualizaciones firmadas con el mismo certificado y application ID conservan los datos privados de la instalación.
