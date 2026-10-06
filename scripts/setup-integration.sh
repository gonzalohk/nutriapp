#!/usr/bin/env bash
# Downloads the PostgREST binary used by the integration tests into .cache/postgrest.
set -euo pipefail
VERSION="v16.4"
ARCH="$(uname -m)"; OS="$(uname -s)"
case "$OS-$ARCH" in
  Linux-x86_64)  FILE="postgrest-$VERSION-linux-static-x86-64.tar.xz" ;;
  Linux-aarch64) FILE="postgrest-$VERSION-linux-static-aarch64.tar.xz" ;;
  Darwin-arm64)  FILE="postgrest-$VERSION-macos-aarch64.tar.xz" ;;
  Darwin-x86_64) FILE="postgrest-$VERSION-macos-x86-64.tar.xz" ;;
  *) echo "Unsupported platform $OS-$ARCH"; exit 1 ;;
esac
mkdir -p .cache/postgrest
curl -sL -o ".cache/postgrest/$FILE" "https://github.com/PostgREST/postgrest/releases/download/$VERSION/$FILE"
tar -xf ".cache/postgrest/$FILE" -C .cache/postgrest
rm ".cache/postgrest/$FILE"
.cache/postgrest/postgrest --version
