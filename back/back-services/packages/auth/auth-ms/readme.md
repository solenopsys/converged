# Auth Service (OIDC)
Users infrmation

## Auth Service (Authorization Server + IdP)

**Таблицы:**
- `users` (id, email, name, picture, email_verified)
- `auth_methods` (user_id, provider, provider_user_id, email)
- `oauth_clients` (client_id, client_secret, redirect_uris, grant_types)
- `authorization_codes` (code, client_id, user_id, code_challenge, expires_at, used)
- `refresh_tokens` (token, client_id, user_id, scope, expires_at, revoked)

**OAuth/OIDC:**
- `/.well-known/openid-configuration`
- `/authorize`
- `/token`
- `/userinfo`
- `/jwks`
- `/revoke`
- **`/register`** ← Dynamic Client Registration (OAuth 2.0)

**User Management:**
- `/api/users/*` (CRUD пользователей)

**Internal:**
- `/internal/auth-complete` (для OAuth Providers Service)
- `/internal/user/:id` (для других сервисов)


Users Service (1 Bun process):
└── LMDB
    ├── users
    ├── auth_methods
    ├── oauth_clients
    ├── authorization_codes
    ├── refresh_tokens
    └── всё остальное



    // users (main)
lmdb.put('user:123', {
  id: '123',
  email: 'user@example.com',
  name: 'John'
});

// auth_methods (secondary index)
lmdb.put('auth_method:github:12345', {
  user_id: '123',
  provider: 'github',
  provider_user_id: '12345'
});

// Индекс: user → auth_methods
lmdb.put('user_auth_methods:123', ['github:12345', 'google:67890']);

// Индекс: email → user_id
lmdb.put('user_by_email:user@example.com', '123');

// oauth_clients
lmdb.put('oauth_client:web-app-prod', {
  client_id: 'web-app-prod',
  redirect_uris: ['https://app.4ir.club/callback']
});