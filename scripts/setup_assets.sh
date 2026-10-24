#!/usr/bin/env bash
set -euo pipefail

# scripts/setup_assets.sh
# Ingests and prepares KayKit Dungeon Pack assets for the Dungeon Agent Sandbox.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${1:-$ROOT_DIR/Public/KayKit_Dungeon_Pack_1.1_FREE/Assets/gltf}"
TARGET_DIR="$ROOT_DIR/assets/kaykit_dungeon"

echo "=== Setup KayKit Dungeon Pack Assets ==="

if [ ! -d "$SOURCE_DIR" ]; then
  echo "⚠️ Source assets directory not found at: $SOURCE_DIR"
  echo "Please download the KayKit Dungeon Pack from: https://kaylousberg.itch.io/kaykit-dungeon-pack"
  echo "and place it under Public/KayKit_Dungeon_Pack_1.1_FREE or pass the path as \$1"
  exit 1
fi

mkdir -p "$TARGET_DIR"

echo "Copying / Linking GLTF assets from $SOURCE_DIR to $TARGET_DIR..."

REQUIRED_FILES=(
  "wall.gltf"
  "wall.bin"
  "wall_corner.gltf"
  "wall_corner.bin"
  "wall_doorway.gltf"
  "wall_doorway.bin"
  "wall_gated.gltf"
  "wall_gated.bin"
  "floor_tile_large.gltf"
  "floor_tile_large.bin"
  "floor_tile_big_spikes.gltf"
  "floor_tile_big_spikes.bin"
  "key.gltf"
  "key.bin"
  "chest.gltf"
  "chest.bin"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$SOURCE_DIR/$file" ]; then
    cp -u "$SOURCE_DIR/$file" "$TARGET_DIR/$file" 2>/dev/null || cp "$SOURCE_DIR/$file" "$TARGET_DIR/$file"
    echo "  ✓ $file"
  else
    echo "  ⚠️ Optional or missing: $file"
  fi
done

# Copy textures if they exist
TEXTURES_DIR="$(dirname "$SOURCE_DIR")/textures"
if [ -d "$TEXTURES_DIR" ]; then
  mkdir -p "$TARGET_DIR/textures"
  cp -r "$TEXTURES_DIR"/* "$TARGET_DIR/textures/" 2>/dev/null || true
  echo "  ✓ Textures copied"
fi

echo "✅ Assets setup completed at: $TARGET_DIR"
