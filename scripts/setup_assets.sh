#!/usr/bin/env bash
set -euo pipefail

# scripts/setup_assets.sh
# Ingests and prepares KayKit Dungeon Pack assets for the Dungeon Agent Sandbox
# and adapts them for apps/web 3D rendering.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${1:-$ROOT_DIR/Public/KayKit_Dungeon_Pack_1.1_FREE/Assets/gltf}"
TARGET_DIR="$ROOT_DIR/assets/kaykit_dungeon"
WEB_MODELS_DIR="$ROOT_DIR/apps/web/public/models/dungeon"

echo "=== Setup KayKit Dungeon Pack Assets ==="

if [ ! -d "$SOURCE_DIR" ]; then
  echo "⚠️ Source assets directory not found at: $SOURCE_DIR"
  echo "Please download the KayKit Dungeon Pack from: https://kaylousberg.itch.io/kaykit-dungeon-pack"
  echo "and place it under Public/KayKit_Dungeon_Pack_1.1_FREE or pass the path as \$1"
  exit 1
fi

mkdir -p "$TARGET_DIR" "$WEB_MODELS_DIR"

echo "Copying GLTF assets to $TARGET_DIR and $WEB_MODELS_DIR..."

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
    cp -u "$SOURCE_DIR/$file" "$WEB_MODELS_DIR/$file" 2>/dev/null || cp "$SOURCE_DIR/$file" "$WEB_MODELS_DIR/$file"
    echo "  ✓ $file"
  else
    echo "  ⚠️ Optional or missing: $file"
  fi
done

# Copy textures
TEXTURES_DIR="$(dirname "$SOURCE_DIR")/textures"
if [ -d "$TEXTURES_DIR" ]; then
  mkdir -p "$TARGET_DIR/textures" "$WEB_MODELS_DIR/textures"
  cp -r "$TEXTURES_DIR"/* "$TARGET_DIR/textures/" 2>/dev/null || true
  cp -r "$TEXTURES_DIR"/* "$WEB_MODELS_DIR/textures/" 2>/dev/null || true
  # KayKit GLTF references textures relative to the GLTF file root:
  cp "$TEXTURES_DIR"/*.png "$TARGET_DIR/" 2>/dev/null || true
  cp "$TEXTURES_DIR"/*.png "$WEB_MODELS_DIR/" 2>/dev/null || true
  echo "  ✓ Textures copied"
fi

# Update apps/web/public/models/catalog.json
CATALOG_FILE="$ROOT_DIR/apps/web/public/models/catalog.json"
cat > "$CATALOG_FILE" << 'EOF'
{
  "dungeon_wall": "/models/dungeon/wall.gltf",
  "dungeon_floor": "/models/dungeon/floor_tile_large.gltf",
  "dungeon_door": "/models/dungeon/wall_gated.gltf",
  "dungeon_key": "/models/dungeon/key.gltf",
  "dungeon_chest": "/models/dungeon/chest.gltf",
  "dungeon_spikes": "/models/dungeon/floor_tile_big_spikes.gltf"
}
EOF
echo "  ✓ Updated apps/web/public/models/catalog.json"

echo "✅ Assets setup and adaptation completed!"
