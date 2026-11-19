#!/usr/bin/env bash
# Завантажує офіційний архів браузерної версії SolidCraft, перевіряє sha256 і розпаковує в web/app/.
# Код SolidCraft не змінюється: на сайті стоїть та сама збірка, що й у релізі авторів.
set -euo pipefail
cd "$(dirname "$0")/.."
. ./solidcraft.env
url="https://github.com/tangency-labs/solidcraft/releases/download/v${SOLIDCRAFT_VERSION}/solidcraft-web-${SOLIDCRAFT_VERSION}.zip"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL -o "$tmp/web.zip" "$url"
echo "${SOLIDCRAFT_SHA256}  $tmp/web.zip" | sha256sum -c -
unzip -q "$tmp/web.zip" -d "$tmp/site"
rm -rf web/app
mv "$tmp/site/solidcraft-web-${SOLIDCRAFT_VERSION}" web/app
echo "SolidCraft ${SOLIDCRAFT_VERSION} → web/app"
