# openscadconvertor

External Bun service that converts uploaded STEP/STP to GLB using CAD Assistant.

## Build image (podman)

```bash
cd <project-root>
podman build -f back/external/openscadconvertor/Dockerfile -t localhost/openscadconvertor:local .
```

## Run container (podman)

```bash
podman run --rm -p 3000:3000 localhost/openscadconvertor:local
```

## Health check

```bash
curl -s http://localhost:3000/health
```

## Convert STEP to GLB

```bash
curl -f -X POST \
  -F "file=@./part.step" \
  http://localhost:3000/convert \
  --output part.glb
```

Notes:
- Request content type must be `multipart/form-data`.
- Form field name: `file`.
- Output is `model/gltf-binary` (`.glb`).
- Under the hood command is `cadassistant -i input.step -o output.glb`.
- Response is returned as soon as `.glb` appears (no fixed wait).
- Hard safety timeout is `CADASSISTANT_TIMEOUT_MS` (default `10000` ms).
- NRPC endpoint is available at `POST /openscadconvertor/convert`.
