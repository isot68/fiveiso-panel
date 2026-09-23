#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -ne 2 ]; then
  echo 'Kullanım: bash install.sh /sunucu/server.cfg /sunucu/resources' >&2
  exit 1
fi
cfg=$(realpath "$1")
resources=$(realpath "$2")
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
[ -f "$cfg" ] && [ -d "$resources" ] && [ -f "$source_dir/fiveiso/license.json" ] || exit 1
[ "$resources/fiveiso" != "$source_dir/fiveiso" ] || { echo 'Paketi resources dışında açın.' >&2; exit 1; }
backup=$(mktemp -d "$(dirname "$cfg")/.fiveiso-backup.XXXXXX")
cp -p -- "$cfg" "$backup/server.cfg"
if [ -e "$resources/fiveiso" ]; then mv -- "$resources/fiveiso" "$backup/fiveiso"; fi
cp -R -- "$source_dir/fiveiso" "$resources/fiveiso"
if [ -f "$backup/fiveiso/database-config.lua" ]; then cp -p -- "$backup/fiveiso/database-config.lua" "$resources/fiveiso/database-config.lua"; fi
chmod 600 "$resources/fiveiso/license.json"
printf '\n# FiveISO kurulumu\n' >> "$cfg"
if ! grep -Eq '^[[:space:]]*add_ace[[:space:]]+resource\.fiveiso[[:space:]]+command[[:space:]]+allow([[:space:]]|$)' "$cfg"; then
  printf 'add_ace resource.fiveiso command allow\n' >> "$cfg"
fi
if ! grep -Eq '^[[:space:]]*(ensure|start)[[:space:]]+fiveiso([[:space:]]|$)' "$cfg"; then
  printf 'ensure fiveiso\n' >> "$cfg"
fi
printf 'Kuruldu. Yedek: %s\nFiveM konsolunda: ensure fiveiso\n' "$backup"
