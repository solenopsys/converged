Authentication
email, aouth2,


# OAuth Providers Service — сущности (коротко)

---

## Таблицы:

### **1. `oauth_providers`**
```
Настройки подключений к внешним провайдерам

provider: 'github'
client_id: 'Iv1.abc123...'        ← ТВОЙ ID у GitHub
client_secret: 'ghp_xyz...'       ← ТВОЙ SECRET у GitHub
authorize_url: 'https://github.com/login/oauth/authorize'
token_url: 'https://github.com/login/oauth/access_token'
userinfo_url: 'https://api.github.com/user'
scopes: ['user:email', 'read:user']
enabled: true
```

### **2. `oauth_states`**
```
CSRF защита (временные, TTL 10 min)

state: 'random-uuid'
return_to: 'https://users-service/auth/callback?session=xyz'
provider: 'github'
expires_at: timestamp
```


---

# НЕТ! Users Service НЕ знает о вышестоящих!

---

## Users Service знает только:

### **Таблица `auth_methods`:**
```
user_id: 'user-uuid-abc'
provider: 'github'                    ← просто строка (тег)
provider_user_id: '123456789'         ← ID от провайдера
email: 'john@gmail.com'
```

**Users Service НЕ знает:**
- ❌ GitHub client_id/client_secret
- ❌ GitHub OAuth URLs
- ❌ Как работает GitHub OAuth
- ❌ Что такое Google, Apple, Discord

**Users Service знает только:**
- ✅ Есть провайдер с названием "github"
- ✅ У этого провайдера user с ID "123456789"
- ✅ Этот provider_user связан с моим user-uuid-abc

---

## Взаимодействие:

```
OAuth Providers Service:
├── Знает ВСЁ про GitHub/Google
├── Делает OAuth flow
└── Возвращает Users Service:
    {
      provider: 'github',
      provider_user_id: '123456789',
      email: 'john@gmail.com',
      name: 'John Doe'
    }

Users Service:
├── Получает нормализованные данные
├── НЕ знает откуда они (не важно!)
├── Создаёт/находит user
└── Связывает через auth_methods
```

---

## `provider` — это просто строка (enum):

```typescript
// Users Service
type Provider = 'github' | 'google' | 'apple' | 'discord' | 'email';

// Никакой конфигурации провайдеров!
// Просто тег для идентификации auth_method
```

---

## Полная изоляция:

```
OAuth Providers Service = знает про вышестоящих
Users Service = знает только результат (provider_user_id)
```

**Users Service агностичен к провайдерам!**

---

**Короче: Users Service видит только `provider: 'github'` как строку, не знает деталей.**

## Ответственность:

✅ Хранит ТВОИ credentials у внешних провайдеров (GitHub, Google)  
✅ Делает OAuth flow с провайдерами  
✅ Нормализует данные (GitHub format → unified format)  
✅ Возвращает в Users Service: `{ provider, provider_user_id, email, name }`

❌ НЕ хранит users  
❌ НЕ хранит auth_methods  
❌ НЕ хранит твои oauth_clients  

---

**Итого: 2-3 таблицы, только про ВНЕШНИЕ провайдеры**

 

---

## Что конкретно делает:

### **1. Хранит настройки провайдеров**
```sql
-- Таблица oauth_providers
provider: 'github'
client_id: 'Iv1.abc123...'
client_secret: 'ghp_xyz789...'
authorize_url: 'https://github.com/login/oauth/authorize'
token_url: 'https://github.com/login/oauth/access_token'
userinfo_url: 'https://api.github.com/user'
scopes: ['user:email', 'read:user']
enabled: true
```
oauth_states
---

### **2. Имплементирует OAuth flow для КАЖДОГО провайдера**

```typescript
// providers/github.provider.ts
export class GitHubProvider {
  async startAuth(state: string) {
    const config = await db.oauth_providers.findOne({ provider: 'github' });
    
    const authUrl = new URL(config.authorize_url);
    authUrl.searchParams.set('client_id', config.client_id);
    authUrl.searchParams.set('redirect_uri', `${CALLBACK_URL}/github/callback`);
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('state', state);
    
    return authUrl.toString();
  }
  
  async handleCallback(code: string) {
    const config = await db.oauth_providers.findOne({ provider: 'github' });
    
    // 1. Обменять code на access_token
    const tokenResponse = await fetch(config.token_url, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new URLSearchParams({
        client_id: config.client_id,
        client_secret: config.client_secret,
        code: code,
        redirect_uri: `${CALLBACK_URL}/github/callback`
      })
    });
    
    const { access_token } = await tokenResponse.json();
    
    // 2. Получить user info от GitHub
    const userResponse = await fetch(config.userinfo_url, {
      headers: { 
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      }
    });
    
    const githubUser = await userResponse.json();
    
    // 3. Нормализовать данные
    return {
      provider: 'github',
      provider_user_id: githubUser.id.toString(),
      email: githubUser.email,
      name: githubUser.name,
      picture: githubUser.avatar_url,
      raw: githubUser
    };
  }
}
```

---

### **3. Поддержка РАЗНЫХ провайдеров (у каждого свои особенности)**

**GitHub:**
```typescript
// GitHub возвращает token в JSON
headers: { 'Accept': 'application/json' }
```

**Google:**
```typescript
// Google требует prompt parameter
authUrl.searchParams.set('prompt', 'consent');
// Google использует id_token (OIDC)
const { id_token } = tokenResponse;
const userInfo = jwt.decode(id_token);
```

**Apple:**
```typescript
// Apple требует client_secret как JWT!
const clientSecret = createJWT({
  iss: TEAM_ID,
  aud: 'https://appleid.apple.com',
  sub: CLIENT_ID,
  // подписать приватным ключом
});
```

**Discord:**
```typescript
// Discord возвращает user в другом формате
picture: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
```

**Microsoft:**
```typescript
// Microsoft использует tenant_id
authUrl: `https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/authorize`
```

---

### **4. CSRF защита (state management)**

```typescript
// Генерация state
async function createState(returnTo: string, provider: string) {
  const state = crypto.randomUUID();
  
  await db.oauth_states.create({
    state,
    return_to: returnTo,
    provider,
    expires_at: Date.now() + 10 * 60 * 1000 // 10 минут
  });
  
  return state;
}

// Проверка state
async function verifyState(state: string, provider: string) {
  const record = await db.oauth_states.findOne({ state, provider });
  
  if (!record) throw new Error('Invalid state');
  if (record.expires_at < Date.now()) throw new Error('State expired');
  
  await db.oauth_states.delete(state);
  
  return record.return_to;
}
```

---

### **5. Error handling для каждого провайдера**

```typescript
// GitHub может вернуть разные ошибки
if (githubResponse.error === 'access_denied') {
  // User отменил авторизацию
}

// Google может вернуть
if (googleResponse.error === 'invalid_grant') {
  // Code истёк или уже использован
}

// Apple может вернуть
if (appleResponse.error === 'user_cancelled_authorize') {
  // User закрыл окно
}
```

---

### **6. Token refresh (для некоторых провайдеров)**

```typescript
// Некоторые провайдеры выдают refresh_token
async refreshGitHubToken(refreshToken: string) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  
  return response.json();
}
```

---

### **7. Rate limiting и retry logic**

```typescript
// GitHub имеет rate limits
async function callGitHubAPI(url: string, retries = 3) {
  try {
    const response = await fetch(url);
    
    if (response.status === 429) {
      // Rate limit hit
      const retryAfter = response.headers.get('Retry-After');
      await sleep(retryAfter * 1000);
      
      if (retries > 0) {
        return callGitHubAPI(url, retries - 1);
      }
    }
    
    return response.json();
  } catch (error) {
    if (retries > 0) {
      await sleep(1000);
      return callGitHubAPI(url, retries - 1);
    }
    throw error;
  }
}
```

---

### **8. Webhook handling (для некоторых провайдеров)**

```typescript
// GitHub может слать webhooks когда user revokes access
POST /webhooks/github
{
  "action": "revoked",
  "authorization": {
    "id": 123,
    "user": { "id": 456 }
  }
}

// Нужно:
// 1. Верифицировать signature
// 2. Уведомить Users Service
// 3. Отозвать токены
```

---

### **9. Admin UI для управления провайдерами**

```
GET  /api/providers        // список провайдеров
POST /api/providers        // добавить провайдер
PUT  /api/providers/:id    // настроить
POST /api/providers/:id/test // тест подключения
GET  /api/providers/:id/stats // статистика использования
```

---

### **10. Email провайдер (интеграция)**

```typescript
// providers/email.provider.ts
export class EmailProvider {
  async startAuth(email: string, state: string) {
    const returnTo = await getReturnTo(state);
    
    // Вызываем Auth-Email Service
    await fetch('https://auth-email-service/send-magic-link', {
      method: 'POST',
      body: JSON.stringify({
        email,
        return_to: `${CALLBACK_URL}/email/callback?state=${state}`
      })
    });
    
    return { message: 'Check your email' };
  }
  
  async handleCallback(email: string, verified: boolean) {
    if (!verified) throw new Error('Email not verified');
    
    return {
      provider: 'email',
      provider_user_id: email,
      email: email,
      email_verified: true
    };
  }
}
```

---

### **11. Нормализация данных**

```typescript
// Каждый провайдер возвращает данные в своём формате
interface NormalizedUser {
  provider: string;
  provider_user_id: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

function normalizeGitHubUser(githubUser: any): NormalizedUser {
  return {
    provider: 'github',
    provider_user_id: githubUser.id.toString(),
    email: githubUser.email,
    name: githubUser.name || githubUser.login,
    picture: githubUser.avatar_url,
    email_verified: githubUser.email !== null
  };
}

function normalizeGoogleUser(googleUser: any): NormalizedUser {
  return {
    provider: 'google',
    provider_user_id: googleUser.sub,
    email: googleUser.email,
    name: googleUser.name,
    picture: googleUser.picture,
    email_verified: googleUser.email_verified
  };
}
```

---

### **12. Scope management**

```typescript
// Разные провайдеры, разные scopes
const PROVIDER_SCOPES = {
  github: ['user:email', 'read:user'],
  google: ['openid', 'email', 'profile'],
  apple: ['email', 'name'],
  discord: ['identify', 'email'],
  microsoft: ['openid', 'email', 'profile']
};

// Динамическая настройка через БД
async function getScopes(provider: string) {
  const config = await db.oauth_providers.findOne({ provider });
  return config.scopes || PROVIDER_SCOPES[provider];
}
```

---

### **13. Логирование и мониторинг**

```typescript
// Логи для каждого провайдера
logger.info('GitHub OAuth started', { state, user_agent });
logger.info('GitHub callback received', { code: code.slice(0, 10) });
logger.info('GitHub token exchanged', { user_id: githubUser.id });
logger.error('GitHub OAuth failed', { error, state });

// Метрики
metrics.increment('oauth.provider.github.started');
metrics.increment('oauth.provider.github.success');
metrics.increment('oauth.provider.github.failed');
metrics.timing('oauth.provider.github.duration', duration);
```

---

## Структура кода:

```
oauth-providers-service/
├── src/
│   ├── providers/
│   │   ├── github.provider.ts      ~200 строк
│   │   ├── google.provider.ts      ~250 строк (OIDC)
│   │   ├── apple.provider.ts       ~300 строк (сложный!)
│   │   ├── discord.provider.ts     ~150 строк
│   │   ├── microsoft.provider.ts   ~200 строк
│   │   ├── email.provider.ts       ~100 строк
│   │   └── base.provider.ts        ~100 строк (abstract)
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts      ~150 строк
│   │   └── admin.controller.ts     ~200 строк
│   │
│   ├── services/
│   │   ├── state.service.ts        ~100 строк
│   │   └── provider.service.ts     ~150 строк
│   │
│   ├── utils/
│   │   ├── normalize.ts            ~100 строк
│   │   └── retry.ts                ~50 строк
│   │
│   └── webhooks/
│       └── github.webhook.ts       ~100 строк
│
└── tests/                          ~1000 строк
```

**Итого: ~2500-3000 строк кода (не 100!)**

---

## Итого, OAuth Providers Service:

✅ Интеграция с 5-10 провайдерами (каждый уникален)  
✅ OAuth flow для каждого  
✅ Нормализация данных  
✅ Error handling  
✅ State management (CSRF)  
✅ Rate limiting  
✅ Retry logic  
✅ Webhooks  
✅ Admin UI  
✅ Monitoring  

**Это полноценный микросервис, не просто "хранилище настроек"!**

---

**Понятно теперь зачем отдельный сервис?**