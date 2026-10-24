Aris v2 - v1 exported for the SINN Engine (SINNON Game Engine) by the SINNON.NET Asset Generator
Asset awyedmjk in project mus3o. Format: docs/export/FORMAT.md.

WHAT IS HERE
  models/aris-v2/model.glb       the merged model; rig, slots, item, motion and colliders stay in its scene extras
  models/aris-v2/*.json          the same data as files, plus readiness / provenance when the version has them
  models/aris-v2/preview.png
  world/aris-v2.kit.json          a kit entry (footprintM, heightM, front, boundsM, triangles, source) for assets/world/*.json

INSTALL
  Copy models/aris-v2/ to assets/models/<category>/aris-v2/ and change the "model" path in the prefab / kit / equipment
  snippet to match.

WHAT WAS DONE
  Draw calls 10 -> 1 (entities draw one primitive per node, no instancing):
  static meshes merged into the nodes clips, sockets, slots, the rig and motion events name; one primitive per material.
  Colliders: parts on folded nodes moved to the node now carrying their mesh (shape re-expressed in its frame).
  Textures: flat maps made 4x4, identical maps shared (glb_tex_slim's lossless steps; --max / --jpeg budgets are still yours).
  LODs: none authored - the engine builds them at load for static models (model_lod.cpp).
