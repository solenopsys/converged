# ms-static

SSR cache service.

- `getData(id)` reads only KVS for the hot path.
- `setData(params)` writes content to KVS and updates SQL meta.
- SQL meta is used for admin UI and queue-style loading.
