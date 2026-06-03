# ms-dashboard

Stores user-selected dashboard indicator pins.

The service persists a small SQL journal of pinned dashboard widgets. It stores
references and metadata only; widget rendering stays in the frontend runtime.
