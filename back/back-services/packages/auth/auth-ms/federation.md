# ДА! Двойная роль — это нормально!

---

## Твоя система работает В ДВУХ направлениях:

### **1. Ты — Authorization Server (для других)**
```
Твоё приложение выдаёт токены ДЛЯ:
├── Твой SPA
├── Твой mobile app
├── Claude Code
├── Zapier
└── Сторонние интеграции

У ТЕБЯ регистрируются oauth_clients
```

### **2. Ты — OAuth Client (у других провайдеров)**
```
Твоё приложение САМО является клиентом У:
├── GitHub
├── Google
├── Apple
└── Discord

ТЫ регистрируешься как client у них
```

---

## Визуально:

```
┌─────────────────────────────────────────────────┐
│  ТЫ = Authorization Server                      │
│                                                 │
│  oauth_clients (у тебя):                        │
│  ├── mobile-app (твой клиент)                   │
│  ├── web-app (твой клиент)                      │
│  └── zapier-integration (сторонний клиент)      │
└─────────────────────────────────────────────────┘
                        ↑
                        │ твои клиенты логинятся через тебя
                        │

┌─────────────────────────────────────────────────┐
│  ТЫ = OAuth Client (у GitHub/Google)            │
│                                                 │
│  Регистрация У НИХ:                             │
│  ├── GitHub OAuth App                           │
│  │   client_id: Iv1.abc123...                   │
│  │   client_secret: ghp_xyz...                  │
│  │                                               │
│  └── Google OAuth App                           │
│      client_id: 123-xyz.apps.googleusercontent  │
│      client_secret: GOCSPX-...                  │
└─────────────────────────────────────────────────┘
```

---

## Где хранятся credentials:

### **У ТЕБЯ (Users Service):**
```
LMDB:
├── oauth_clients           ← КТО может логиниться ЧЕРЕЗ тебя
│   ├── mobile-app
│   ├── web-app
│   └── zapier
```

### **У ДРУГИХ (OAuth Providers Service):**
```
LMDB:
├── oauth_providers         ← ТВОИ credentials У других
│   ├── github:
│   │   client_id: Iv1.abc123
│   │   client_secret: ghp_xyz
│   │
│   ├── google:
│   │   client_id: 123-xyz.apps...
│   │   client_secret: GOCSPX-...
```

---

## Полный flow:

```
1. User на ТВОЁМ mobile app → кликает "Login"

2. Mobile app (твой клиент):
   client_id: mobile-app ← зарегистрирован У ТЕБЯ
   
   GET https://auth.4ir.club/authorize?client_id=mobile-app

3. Users Service проверяет:
   oauth_clients.get('mobile-app') ← есть? OK
   
4. User выбирает "Login with GitHub"

5. OAuth Providers Service:
   - Читает oauth_providers.get('github')
   - Видит ТВОИ credentials у GitHub:
     client_id: Iv1.abc123 ← ТЫ клиент у GitHub!
     
   - Редиректит на GitHub:
     https://github.com/login/oauth/authorize?
       client_id=Iv1.abc123 ← ТВОЙ client_id у GitHub

6. GitHub: "App '4ir.club' wants access"
   
7. User разрешает → GitHub callback

8. OAuth Providers Service:
   - Обменивает code на GitHub access_token
   - Используя ТВОЙ client_secret у GitHub
   - Получает user info от GitHub

9. Users Service:
   - Создаёт/находит user у СЕБЯ
   - Создаёт authorization_code
   - Редирект в mobile app: app://callback?code=xyz

10. Mobile app:
    POST /token
    client_id: mobile-app ← ОН клиент у тебя
    code: xyz
    
11. Users Service выдаёт JWT
```

---

## Двойная роль — таблица:

| Контекст | Ты — кто? | client_id | Где хранится |
|----------|-----------|-----------|--------------|
| Mobile app → Твой AS | **Server** | `mobile-app` | У тебя: `oauth_clients` |
| Web app → Твой AS | **Server** | `web-app` | У тебя: `oauth_clients` |
| Zapier → Твой AS | **Server** | `zapier-123` | У тебя: `oauth_clients` |
| Ты → GitHub | **Client** | `Iv1.abc123` | У GitHub (ты регистрировался) |
| Ты → Google | **Client** | `123-xyz.apps...` | У Google (ты регистрировался) |

---

## Регистрация у GitHub/Google:

### **Ты идёшь на GitHub:**
```
https://github.com/settings/developers
→ New OAuth App

Application name: 4ir.club
Homepage URL: https://4ir.club
Authorization callback URL: https://auth.4ir.club/auth/github/callback

→ Получаешь:
   Client ID: Iv1.abc123def456
   Client Secret: ghp_xyz789...
```

### **Сохраняешь У СЕБЯ:**
```typescript
// OAuth Providers Service
lmdb.put('oauth_provider:github', {
  provider: 'github',
  client_id: 'Iv1.abc123def456',      // ← ТВОЙ ID у GitHub
  client_secret: 'ghp_xyz789...',     // ← ТВОЙ SECRET у GitHub
  authorize_url: 'https://github.com/login/oauth/authorize',
  token_url: 'https://github.com/login/oauth/access_token'
});
```

---

## Аналогия с почтой:

```
ТЫ = Почтовое отделение:
├── У тебя регистрируются люди (твои клиенты)
│   - Вася (mobile-app)
│   - Петя (web-app)
│
└── Но ТЫ САМ зарегистрирован в:
    - FedEx (GitHub)
    - DHL (Google)
    
    Чтобы отправлять посылки через них!
```

---

## Это называется "Federation":

```
Users Service = Federation Hub

     Клиенты                    Провайдеры
        ↓                            ↑
┌──────────────┐            ┌──────────────┐
│  Mobile App  │            │    GitHub    │
│  (client у   │───────────→│ (ты client)  │
│   тебя)      │            └──────────────┘
└──────────────┘                    ↑
                                    │
┌──────────────┐                    │
│   Web App    │                    │
│  (client у   │────────────────────┘
│   тебя)      │            
└──────────────┘            ┌──────────────┐
                            │    Google    │
┌──────────────┐            │ (ты client)  │
│   Zapier     │───────────→└──────────────┘
│  (client у   │
│   тебя)      │
└──────────────┘
```

**Ты в середине — сводишь вместе своих клиентов и внешних провайдеров!**

---

## Итого:

✅ **У тебя ЕСТЬ клиенты** (mobile, web, zapier) — ты для них **Server**  
✅ **Ты САМ клиент** у GitHub/Google — ты для них **Client**  
✅ **Это нормально** — называется Federation  
✅ **Две таблицы:** `oauth_clients` (твои клиенты) + `oauth_providers` (твои credentials у других)

---

**Теперь понятна двойная роль?**