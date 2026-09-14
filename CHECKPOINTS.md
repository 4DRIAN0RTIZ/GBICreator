# CHECKPOINTS — Evaluación del estado final

> En sistemas multi-agente no se evalúa el camino, se evalúa el destino.
> Estos son los checkpoints objetivos que un juez (humano o IA) puede usar
> para decidir si el proyecto está sano.

## C1 — El arnés está completo

- [ ] Existen los 4 archivos base: `AGENTS.md`, `init.sh`, `feature_list.json`,
      `progress/current.md`.
- [ ] Existen los 3 docs: `docs/architecture.md`, `docs/conventions.md`,
      `docs/verification.md`.
- [ ] `./init.sh` termina con exit code 0.

## C2 — El estado es coherente

- [ ] Como mucho una feature en `in_progress` en `feature_list.json`.
- [ ] Toda feature `done` tiene tests asociados que pasan (`npm test`).
- [ ] `progress/current.md` está vacío o describe la sesión activa
      (no contiene basura de sesiones anteriores).

## C3 — El código respeta la arquitectura

- [ ] `src/domain/` no importa React ni accede a IO; `src/lib/` no importa
      React y centraliza el acceso a `fetch`/migración legada según
      `docs/architecture.md`.
- [ ] `src/components/` no accede a `localStorage`/`fetch` directamente,
      solo a través de hooks (`src/hooks/`).
- [ ] No hay `console.log` sueltos para debug, ni TODOs sin contexto.

## C4 — La verificación es real

- [ ] `src/domain/` y `src/lib/` tienen al menos un test por módulo público
      nuevo o modificado.
- [ ] `npm test` muestra > 0 tests y todos verdes.
- [ ] `npm run build` termina sin errores.

## C5 — La sesión se cerró bien

- [ ] No hay archivos sin trackear sospechosos (`*.tmp`, `node_modules`
      fuera del `.gitignore`, `dist/` generado a medias).
- [ ] `progress/history.md` tiene una entrada por la última sesión.
- [ ] La última feature trabajada está reflejada en su estado correcto en
      `feature_list.json`.

---

**Cómo usar este archivo:** un agente revisor (`.claude/agents/reviewer.md`)
recorre cada checkbox, marca `[x]` o `[ ]`, y rechaza el cierre de sesión
si quedan boxes vacíos en C1-C5.
