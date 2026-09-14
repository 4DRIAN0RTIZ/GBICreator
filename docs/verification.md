# Verificación — Cómo demostrar que el trabajo funciona

> Regla de oro: **el agente no dice "funciona", lo demuestra**.
> Toda feature termina con evidencia ejecutable, no con afirmaciones.

## Niveles de verificación

### Nivel 1 — Tests unitarios (obligatorio)

Toda función pública nueva o modificada en `src/domain/` o `src/lib/` tiene
al menos un test en un archivo `<módulo>.test.js` junto a ella que:

1. Cubre el camino feliz.
2. Cubre al menos un caso borde o de error si la función puede fallar.

Comando:
```bash
npm test
```

### Nivel 2 — Build de producción (obligatorio)

El build de Vite debe compilar sin errores — detecta imports rotos, JSX
inválido o dependencias faltantes que los tests unitarios no cubren:

```bash
npm run build
```

### Nivel 3 — Smoke test manual (opcional pero recomendado)

Antes de cerrar la sesión, levanta la app en modo desarrollo y ejercita el
flujo afectado por la feature a mano:

```bash
npm run dev:server
npm run dev
# abrir la URL que imprime Vite y probar el flujo manualmente
```

Para features que tocan persistencia (como la feature 1,
`sql_shared_persistence`): verificar explícitamente que los datos
sobreviven a un refresh de página y, si aplica, que dos pestañas/usuarios
distintos ven los mismos datos.

## Anti-patrones (no hacer)

- ❌ "He añadido el endpoint, debería funcionar." → falta test ejecutable.
- ❌ Test que solo verifica que la función no lanza excepción → tiene que
  comprobar el resultado concreto.
- ❌ Mockear `fetch`/`localStorage` de forma que el test siempre pase pase
  lo que pase en la implementación real.
- ❌ Marcar la feature como `done` sin pasar `./init.sh`.

## Verificación final antes de cerrar

```bash
./init.sh           # debe terminar con [OK] Entorno listo
```

Si `./init.sh` está rojo, **no** marques nada como `done`. Anota el bloqueo
en `progress/current.md` con estado `blocked` en `feature_list.json`.
