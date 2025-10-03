# ДА! Юзеры могут быть ОДНОВРЕМЕННО:

---

## 1. Юзеры Google (у Google)
## 2. Юзеры твоей системы (у тебя)
## 3. Юзеры дочерних приложений (через тебя)

---

## Визуально:

```
┌─────────────────────────────────────────────────┐
│  Google (Identity Provider)                     │
│  users:                                         │
│  ├── john@gmail.com (Google user ID: 123456)   │
│  └── mary@gmail.com (Google user ID: 789012)   │
└─────────────────────────────────────────────────┘
                    ↓ логинятся через OAuth
┌─────────────────────────────────────────────────┐
│  4ir.club (твоя система)                        │
│  users:                                         │
│  ├── user-uuid-1                                │
│  │   auth_methods:                              │
│  │   ├── google: 123456 ← связь с Google       │
│  │   └── github: 98765 ← тот же user!          │
│  │                                               │
│  └── user-uuid-2                                │
│      auth_methods:                              │
│      └── google: 789012                         │
└─────────────────────────────────────────────────┘
                    ↓ логинятся в дочерние приложения
┌─────────────────────────────────────────────────┐
│  Mobile App (дочернее приложение)               │
│  "Я пускаю user-uuid-1"                         │
│  (через твой Authorization Server)              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Zapier Integration (дочернее приложение)       │
│  "Я пускаю user-uuid-1"                         │
│  (через твой Authorization Server)              │
└─────────────────────────────────────────────────┘
```

---

## Конкретный пример:

### **John работает так:**

```
1. John имеет аккаунт Google (john@gmail.com)
   Google user ID: 123456

2. John логинится в ТВОЙ SaaS через Google
   → Ты создаёшь user у себя:
   
   users:
   ├── id: user-uuid-abc
   ├── email: john@gmail.com
   
   auth_methods:
   ├── provider: google
   ├── provider_user_id: 123456 ← Google ID
   └── user_id: user-uuid-abc

3. John потом добавляет GitHub логин
   → Ты связываешь с ТЕМ ЖЕ user:
   
   auth_methods:
   ├── provider: google
   │   provider_user_id: 123456
   │   user_id: user-uuid-abc
   │
   └── provider: github
       provider_user_id: 98765 ← GitHub ID
       user_id: user-uuid-abc ← ТОТ ЖЕ USER!

4. John использует mobile app (твоё дочернее приложение)
   → Mobile app получает токен от ТЕБЯ с user_id: user-uuid-abc
   
5. John использует Zapier integration
   → Zapier получает токен от ТЕБЯ с user_id: user-uuid-abc
   
6. John использует web app
   → Web app получает токен от ТЕБЯ с user_id: user-uuid-abc
```

**Один человек = один user_id у тебя = много auth_methods = много дочерних приложений**

---

## Identity mapping:

```
Google:             Ты:                 Дочерние приложения:
john@gmail.com  →   user-uuid-abc   →   Mobile app (видит user-uuid-abc)
(ID: 123456)        │                   Web app (видит user-uuid-abc)
                    │                   Zapier (видит user-uuid-abc)
                    │
GitHub:             │
john_dev        →   │ (тот же user!)
(ID: 98765)         │

Email:              │
john@work.com   →   │ (тот же user!)
```

**Ты — центральный Identity Provider, который агрегирует разные identity!**

---

## Таблица auth_methods показывает связь:

```typescript
// В LMDB/SQLite
auth_methods = [
  {
    user_id: 'user-uuid-abc',
    provider: 'google',
    provider_user_id: '123456',  // ← John у Google
    email: 'john@gmail.com'
  },
  {
    user_id: 'user-uuid-abc',     // ← ТОТ ЖЕ USER!
    provider: 'github',
    provider_user_id: '98765',    // ← John у GitHub
    email: 'john@work.com'
  },
  {
    user_id: 'user-uuid-abc',     // ← ТОТ ЖЕ USER!
    provider: 'email',
    provider_user_id: 'john@personal.com',
    email: 'john@personal.com'
  }
]
```

**John может логиниться 3 способами → всегда попадает в того же user!**

---

## Дочерние приложения не знают про Google/GitHub:

```
Mobile App делает:
POST /token
code: xyz123

Получает:
{
  "access_token": "eyJ...",
  "id_token": {
    "sub": "user-uuid-abc",    // ← только ТВОЙ ID!
    "email": "john@gmail.com",
    "name": "John"
    // НЕТ упоминания Google/GitHub!
  }
}
```

**Mobile app знает только про `user-uuid-abc`, не знает что это Google user!**

---

## Три уровня identity:

### **Уровень 1: Внешние провайдеры**
```
Google: john@gmail.com (ID: 123456)
GitHub: john_dev (ID: 98765)
Apple: john@icloud.com (ID: abc.def.ghi)
```
**Разные идентичности, разные ID**

### **Уровень 2: Твоя система (нормализация)**
```
user-uuid-abc
├── Связан с Google (123456)
├── Связан с GitHub (98765)
└── Связан с Apple (abc.def.ghi)
```
**Один user = много auth_methods**

### **Уровень 3: Дочерние приложения**
```
Mobile app видит: user-uuid-abc
Web app видит: user-uuid-abc
Zapier видит: user-uuid-abc
```
**Приложения видят только ТВОЙ unified ID**

---

## Это называется "Identity Federation":

```
Много внешних identities → Один твой user → Много приложений
```

**Ты — посредник между внешними провайдерами и своими приложениями!**

---

## Account Linking (связывание аккаунтов):

```
Сценарий:
1. John логинится через Google → создаётся user-uuid-abc
2. Через неделю John логинится через GitHub
3. Ты видишь: тот же email (john@gmail.com)
4. Спрашиваешь: "Связать с существующим аккаунтом?"
5. John: "Да"
6. Добавляешь в auth_methods:
   user_id: user-uuid-abc (тот же!)
   provider: github
```

---

## UI для пользователя:

```
Настройки аккаунта:

Ваш ID: user-uuid-abc

Способы входа:
✅ Google (john@gmail.com) [Primary]
✅ GitHub (john_dev)
✅ Email (john@personal.com)
➕ Добавить Apple ID

Приложения с доступом:
✅ Mobile App (последний вход: 2 часа назад)
✅ Web App (последний вход: вчера)
✅ Zapier Integration (последний вход: неделю назад)
```

---

## Итого:

✅ **John = user у Google**  
✅ **John = user у тебя** (с связью на Google)  
✅ **John = user для дочерних приложений** (через тебя)  

**Три уровня, но один человек!**

```
Google User → Твой User → User в дочерних приложениях
(внешний ID) → (твой ID) → (видят твой ID)
```

**Ты — Identity Hub, который связывает всё воедино!**

---

**Понял схему с тремя уровнями?**