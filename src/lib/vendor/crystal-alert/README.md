# CrystalAlert (vendorizado)

- Origen: https://github.com/4DRIAN0RTIZ/CrystalAlert — tag `v1.1.6` (commit `c5472b1eff8ad096c197154f262f76643cbee28c`), licencia MIT.
- Archivos: `src/crystal-alert.js` → `crystal-alert.js`, `src/crystal-alert-styles.css` → `crystal-alert.css`.
- Única modificación: se añadió `export default Crystal;` al final de `crystal-alert.js`.

Por qué está vendorizado: `crystal-alert` no está publicado en npm y el archivo
upstream no exporta `Crystal` (solo funciona como `<script>` clásico).

No uses `Crystal` directamente desde la app: pasa por `src/lib/dialogs.js`,
que además serializa los diálogos (CrystalAlert es un singleton sin cola: un
segundo `fire()` deja sin resolver la promesa del primero).

Para actualizar: descarga los dos archivos del nuevo tag, vuelve a añadir el
`export default` y actualiza este README. Si upstream publica un build ESM en
npm, sustituye esta carpeta por la dependencia y cambia solo el import de
`src/lib/dialogs.js`.
