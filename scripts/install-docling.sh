#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo est requis pour installer Python et Tesseract." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
sudo apt-get update
sudo apt-get install -y python3-venv python3-pip tesseract-ocr tesseract-ocr-fra poppler-utils

if [[ -x .venv-docling/bin/python ]] && .venv-docling/bin/python scripts/docling_extract.py --ready; then
  echo "Docling est déjà installé."
  exit 0
fi

python3 -m venv .venv-docling
.venv-docling/bin/pip install -U pip
.venv-docling/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv-docling/bin/pip install 'docling==2.130.0'
.venv-docling/bin/pip install torchvision --index-url https://download.pytorch.org/whl/cpu

mkdir -p data/docling
DOCLING_ARTIFACTS_PATH="$PWD/data/docling" \
DOCLING_DEVICE=cpu \
OMP_NUM_THREADS=4 \
HF_HOME="$PWD/data/docling/hf" \
HF_HUB_DISABLE_TELEMETRY=1 \
  .venv-docling/bin/python scripts/docling_extract.py --prefetch

echo "Docling est prêt. La lecture des pièces se fait sur cette machine."
