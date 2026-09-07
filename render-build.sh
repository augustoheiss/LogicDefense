#!/usr/bin/env bash
# render-build.sh — Build script para ambientes Linux (Render / Docker / CI)
set -o errexit

echo "==> [LogicDefense Backend Build] Atualizando pip..."
pip install --upgrade pip

echo "==> [LogicDefense Backend Build] Instalando dependências de backend/requirements.txt..."
pip install -r backend/requirements.txt

echo "==> [LogicDefense Backend Build] Instalando binários do Chromium para Playwright..."
python -m playwright install chromium

echo "==> [LogicDefense Backend Build] Build concluído com sucesso!"
