#!/usr/bin/env bash
# backend/build.sh — Build script quando o Root Directory do Render é 'backend'
set -o errexit

echo "==> [Backend Build] Atualizando pip..."
pip install --upgrade pip

echo "==> [Backend Build] Instalando dependências..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
elif [ -f "backend/requirements.txt" ]; then
    pip install -r backend/requirements.txt
fi

echo "==> [Backend Build] Instalando binários do Chromium..."
python -m playwright install chromium

echo "==> [Backend Build] Concluído com sucesso!"
