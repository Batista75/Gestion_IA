#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo est requis pour installer Node.js et PostgreSQL." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
sudo apt-get update
sudo apt-get install -y ca-certificates curl xz-utils postgresql postgresql-contrib poppler-utils python3-venv python3-pip tesseract-ocr tesseract-ocr-fra

install_node() {
  local arch node_arch line name
  arch="$(uname -m)"
  case "$arch" in
    x86_64) node_arch="linux-x64" ;;
    aarch64) node_arch="linux-arm64" ;;
    *)
      echo "Architecture non prise en charge : $arch" >&2
      exit 1
      ;;
  esac

  line="$(curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt | grep "node-v22\\..*-${node_arch}.tar.xz$" | head -n 1)"
  name="$(awk '{print $2}' <<<"$line")"
  if [[ -z "$name" ]]; then
    echo "Impossible de trouver Node.js 22 pour $node_arch." >&2
    exit 1
  fi

  curl -fsSL "https://nodejs.org/dist/latest-v22.x/${name}" -o "/tmp/${name}"
  awk -v file="$name" '$2 == file {print}' <<<"$line" | (cd /tmp && sha256sum -c -)
  sudo tar -xJf "/tmp/${name}" -C /usr/local --strip-components=1
  hash -r
}

node_major=0
if command -v node >/dev/null 2>&1; then
  node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
fi

if [[ "$node_major" -lt 20 ]]; then
  install_node
fi

echo "Node $(node -v), npm $(npm -v)"
npm ci
bash scripts/install-docling.sh
exec bash scripts/cloud-agent-start.sh
