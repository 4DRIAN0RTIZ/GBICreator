#!/usr/bin/env bash
# init.sh — Verificación e inicialización del entorno
#
# Este script lo ejecuta el agente al COMENZAR una sesión y antes de
# declarar cualquier tarea como `done`. Si falla, la sesión no debe avanzar.
#
# Salida esperada: códigos de salida claros y bloques marcados con [OK]/[FAIL].

set -u
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

ok()    { printf "${GREEN}[OK]${NC}    %s\n" "$1"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$1"; }
fail()  { printf "${RED}[FAIL]${NC}  %s\n" "$1"; }

EXIT_CODE=0

echo "── 1. Verificando entorno ─────────────────────────────"

if ! command -v node >/dev/null 2>&1; then
  fail "node no está instalado"
  exit 1
fi
ok "node -> $(node --version)"

if ! command -v npm >/dev/null 2>&1; then
  fail "npm no está instalado"
  exit 1
fi
ok "npm -> $(npm --version)"

echo ""
echo "── 2. Verificando archivos base del arnés ──────────────"

for f in AGENTS.md feature_list.json progress/current.md docs/architecture.md docs/conventions.md docs/verification.md CHECKPOINTS.md; do
  if [ ! -f "$f" ]; then
    fail "Falta archivo base: $f"
    EXIT_CODE=1
  else
    ok "Existe $f"
  fi
done

echo ""
echo "── 3. Validando feature_list.json ──────────────────────"

node --input-type=module -e '
import { readFileSync } from "node:fs";
try {
  const data = JSON.parse(readFileSync("feature_list.json", "utf8"));
  const valid = new Set(["pending", "in_progress", "done", "blocked"]);
  const inProgress = data.features.filter((f) => f.status === "in_progress");
  if (inProgress.length > 1) {
    console.log(`[FAIL]  Hay ${inProgress.length} features en in_progress (máximo 1)`);
    process.exit(1);
  }
  for (const f of data.features) {
    if (!valid.has(f.status)) {
      console.log(`[FAIL]  Estado inválido en feature ${f.id}: ${f.status}`);
      process.exit(1);
    }
  }
  console.log(`[OK]    feature_list.json válido (${data.features.length} features)`);
} catch (error) {
  console.log(`[FAIL]  feature_list.json inválido: ${error.message}`);
  process.exit(1);
}
'

if [ $? -ne 0 ]; then EXIT_CODE=1; fi

echo ""
echo "── 4. Instalando dependencias y ejecutando tests ───────"

if [ -f "package.json" ]; then
  if npm ci >/dev/null 2>&1; then
    ok "Dependencias instaladas (npm ci)"
  elif npm install >/dev/null 2>&1; then
    ok "Dependencias instaladas (npm install)"
  else
    fail "No se pudieron instalar las dependencias"
    EXIT_CODE=1
  fi

  if npm test; then
    ok "Todos los tests pasan"
  else
    fail "Hay tests rotos"
    EXIT_CODE=1
  fi
else
  warn "package.json no existe"
fi

echo ""
echo "── 5. Resumen ──────────────────────────────────────────"

if [ $EXIT_CODE -eq 0 ]; then
  ok "Entorno listo. Puedes empezar a trabajar."
else
  fail "Entorno NO está listo. Resuelve los errores antes de avanzar."
fi

exit $EXIT_CODE
