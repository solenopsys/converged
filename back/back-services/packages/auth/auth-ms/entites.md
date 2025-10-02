# Users Service — сущности (финально)

---

## Таблицы в LMDB:

### **1. `users`**
```
id, email, name, picture, email_verified, created_at
```

### **2. `auth_methods`**
```
user_id, provider, provider_user_id, email, last_used_at
```

### **3. `oauth_clients`**
```
client_id, client_secret, redirect_uris, grant_types, trusted
```

### **4. `authorization_codes`**
```
code, client_id, user_id, code_challenge, expires_at, used
```

### **5. `refresh_tokens`**
```
token, client_id, user_id, scope, expires_at, revoked
```

### **6. `magic_link_tokens`**
```
token, email, return_to, expires_at, used
```

---

**Итого: 6 таблиц**

---

# LMDB Keys для Users Service

---

## 1. `users`

```
Главная:
user:{user_id} → { id, email, name, picture, ... }

Индексы:
user_by_email:{email} → user_id
```

---

## 2. `auth_methods`

```
Главная:
auth:{provider}:{provider_user_id} → { user_id, email, last_used_at }

Индексы:
user_auths:{user_id} → [auth_keys...]  // список auth_methods юзера
```

---

## 3. `oauth_clients`

```
Главная:
client:{client_id} → { client_secret, redirect_uris, grant_types, ... }
```

---

## 4. `authorization_codes`

```
Главная:
authcode:{code} → { client_id, user_id, code_challenge, expires_at, used }
```

---

## 5. `refresh_tokens`

```
Главная:
refresh:{token_hash} → { client_id, user_id, scope, expires_at, revoked }

Индексы:
user_refresh:{user_id}:{client_id} → [token_hashes...]  // для revoke all
```

---

## 6. `magic_link_tokens`

```
Главная:
magic:{token} → { email, return_to, expires_at, used }
```

---

**Итого: главные ключи + индексы для быстрого lookup**