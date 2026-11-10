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
2. Pulsa Run workflow, deja la rama `main` y escribe la versión deseada.
3. Deja `Publish release` desactivado para una compilación de prueba. En ese caso la APK se conserva como artefacto temporal de Actions durante 14 días.
4. Activa `Publish release` únicamente cuando quieras publicar oficialmente: el flujo creará el GitHub Release con la APK firmada y actualizará `latest.json` después de verificar la firma.

## Publicar una versión oficial

1. En Actions selecciona `Run workflow`, branch `main`, introduce la versión y activa `Publish release`.
2. GitHub Actions vuelve a compilar y verificar paquete, versionCode y certificado.
3. Solo si todo pasa, publica el APK en GitHub Releases y actualiza `latest.json` con la URL de descarga y SHA-256.
4. La aplicación instalada consulta el manifiesto y ofrece las versiones posteriores. La primera versión base se instala manualmente; las siguientes se podrán descargar desde el Centro de actualizaciones.

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
