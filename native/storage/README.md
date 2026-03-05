# storage

## Сборка

```bash
zig build -Dall -Doptimize=ReleaseFast
```

## Контейнер

```bash
podman build --layers -f ./Containerfile -t converged-storage .
```

## Структура данных

```
<data-dir>/
  <ms-name>/
    <store-name>/
      manifest.json
      data/
        data.db    # SQL
        mdbx.dat   # KV
        ...        # FILES
```
