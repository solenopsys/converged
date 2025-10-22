# Buddy Blocks Storage API

Simple HTTP API for content-addressable block storage.

## Base URL

```
http://localhost:10001
```

## Endpoints

### Upload Block

**PUT** `/block`

Upload a data block and get its SHA256 hash.

**Request:**
- Method: `PUT`
- Content-Type: `application/octet-stream` (or any)
- Body: Binary data (max 512KB)

**Response:**
- Status: `200 OK`
- Content-Type: `text/plain`
- Body: SHA256 hash (64 hex characters)

**Example (JavaScript):**
```javascript
const data = new Blob(['Hello, World!']);
const response = await fetch('http://localhost:10001/block', {
  method: 'PUT',
  body: data
});
const hash = await response.text();
console.log('Block hash:', hash);
```

**Example (cURL):**
```bash
curl -X PUT --data-binary @file.bin http://localhost:10001/block
# Returns: a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e
```

---

### Download Block

**GET** `/block/{hash}`

Download a data block by its SHA256 hash.

**Request:**
- Method: `GET`
- Path parameter: `hash` - SHA256 hash (64 hex characters)

**Response:**
- Status: `200 OK` if found, `404 Not Found` if missing
- Content-Type: `application/octet-stream`
- Body: Binary data

**Example (JavaScript):**
```javascript
const hash = 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e';
const response = await fetch(`http://localhost:10001/block/${hash}`);
const blob = await response.blob();
console.log('Block size:', blob.size);
```

**Example (cURL):**
```bash
curl http://localhost:10001/block/a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e -o output.bin
```

---

### Delete Block

**DELETE** `/block/{hash}`

Delete a data block.

**Request:**
- Method: `DELETE`
- Path parameter: `hash` - SHA256 hash (64 hex characters)

**Response:**
- Status: `200 OK`
- Content-Type: `text/plain`
- Body: `Block deleted`

**Example (JavaScript):**
```javascript
const hash = 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e';
const response = await fetch(`http://localhost:10001/block/${hash}`, {
  method: 'DELETE'
});
const message = await response.text();
console.log(message); // "Block deleted"
```

**Example (cURL):**
```bash
curl -X DELETE http://localhost:10001/block/a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e
```

---

## Complete Frontend Example

```javascript
class BlockStorage {
  constructor(baseUrl = 'http://localhost:10001') {
    this.baseUrl = baseUrl;
  }

  async upload(data) {
    const response = await fetch(`${this.baseUrl}/block`, {
      method: 'PUT',
      body: data
    });
    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
    return await response.text(); // returns hash
  }

  async download(hash) {
    const response = await fetch(`${this.baseUrl}/block/${hash}`);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    return await response.blob();
  }

  async delete(hash) {
    const response = await fetch(`${this.baseUrl}/block/${hash}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
    return await response.text();
  }
}

// Usage:
const storage = new BlockStorage();

// Upload file
const file = document.querySelector('input[type="file"]').files[0];
const hash = await storage.upload(file);
console.log('Uploaded:', hash);

// Download
const blob = await storage.download(hash);
const url = URL.createObjectURL(blob);

// Delete
await storage.delete(hash);
```

## Error Responses

**400 Bad Request**
- Empty body
- Invalid size

**404 Not Found**
- Block not found

**413 Payload Too Large**
- Block size exceeds 512KB

**500 Internal Server Error**
- Allocation failed
- Internal error

## Notes

- Blocks are content-addressable (hash-based)
- Maximum block size: 512KB
- Hash format: SHA256 in lowercase hex (64 characters)
- CORS is not enabled by default
