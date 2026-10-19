# CHL 3D model quality standard

Existing `.glb` files are audited in place; this upgrade does not overwrite gift artwork. Every model must pass structural GLB 2.0 validation and a visual review before release.

## Automated checks

- GLB magic, version 2, declared byte length and JSON chunk are valid.
- JSON parses and declares `asset.version: "2.0"`.
- Scene graph, nodes, meshes, primitive attributes, and binary chunk structure are reviewed.
- Byte-identical files are reported for manual review.
- Models under 1 KiB are flagged for review as possible placeholders; size alone is not proof of failure.

## Visual / performance checks

- Preview the model with the intended runtime and material pipeline.
- Verify it depicts the correct gift, has visible geometry, sane scale/origin, correct normals, working materials/textures, and no missing external resources.
- Check transparent backgrounds, thumbnail crop, silhouette at small sizes, and dark/light backgrounds.
- Keep triangle count, textures, draw calls and file size appropriate for low-end mobile devices. Provide a poster/thumbnail fallback when WebGL/WebGPU or model loading fails.
- Respect reduced-motion preferences; pause decorative animation when off-screen or the page is backgrounded.
- Never infer coin prices or transaction value from asset filenames/metadata. Database/server records remain authoritative.
