 

## 📌 Разбор по твоему описанию

### 1. **Провайдер**

* **Роль:** абстрагирует доступ к ресурсу (очередь, API, файл, cron и т.д.).
* **Идентификатор:** `name` — уникален в пределах приложения.
* **Базовая конфигурация:** лежит в базе, под ключом `provider:name -> config`.
* **Жизненный цикл:**

  * `init(config)` — инициализация коннекта/ресурса;
  * `start()` — запуск получения событий;
  * `stop()` — завершение работы.
* **Конструктор:**

```ts
class Provider {
  constructor(public name: string, public config: ProviderConfig) {}
}
```

---

### 2. **Пул провайдеров**

* **Роль:** lazy-инициализация и кэширование провайдеров.
* **Поведение:**

  * При старте приложения **пул создаётся пустым**;
  * При первом запросе триггера к пулу → пул смотрит в базу → создаёт провайдер, кладёт в Map.
* **Структура:**

```ts
class ProviderPool {
  private providers = new Map<string, Provider>();

  constructor(private providerFactories: Record<string, ProviderFactory>) {}

  async get(name: string): Promise<Provider> {
    if (!this.providers.has(name)) {
      const config = await db.getProviderConfig(name); // provider:name -> config
      const type = config.type;
      const provider = this.providerFactories[type](name, config);
      await provider.init();
      this.providers.set(name, provider);
    }
    return this.providers.get(name)!;
  }
}
```

---

### 3. **Триггер**

* **Роль:** подписывается на события провайдера и фильтрует/реагирует.
* **Хранение:** в базе `trigger:name -> config`.
* **Структура:**

```ts
class Trigger {
  constructor(
    public name: string,
    public provider: Provider,
    public config: TriggerConfig,
    public handlers: TriggerHandler[]
  ) {}

  async start() {
    this.provider.register(this.name, this.config.filter, (event) => {
      for (const handler of this.handlers) {
        handler(event);
      }
    });
  }
}
```

---

### 4. **Контроллер триггеров**

* **Роль:** orchestration — читает конфиги триггеров, достаёт провайдеры из пула, создаёт и запускает триггеры.
* **Структура:**

```ts
class TriggerController {
  private triggers = new Map<string, Trigger>();

  constructor(private providerPool: ProviderPool, private db: TriggerDb) {}

  /** Инициализация всех триггеров из базы */
  async init() {
    const triggerConfigs = await this.db.getAll();
    for (const cfg of triggerConfigs) {
      await this.createFromConfig(cfg);
    }
  }

  /** Создание триггера (и в памяти, и в БД) */
  async createTrigger(name: string, providerName: string, config: any) {
    await this.db.save({ name, providerName, config });
    return this.createFromConfig({ name, providerName, config });
  }

  /** Удаление триггера */
  async deleteTrigger(name: string) {
    if (this.triggers.has(name)) {
      const trigger = this.triggers.get(name)!;
      trigger.stop();
      this.triggers.delete(name);
    }
    await this.db.delete(name);
  }

  /** Создание объекта триггера из конфига */
  private async createFromConfig(cfg: { name: string; providerName: string; config: any }) {
    const provider = await this.providerPool.get(cfg.providerName);
    const trigger = new Trigger(cfg.name, provider, cfg.config, []);
    trigger.start();
    this.triggers.set(cfg.name, trigger);
  }
}

```

---

### 5. **Поток инициализации**

```
[App Start]
    ↓
Создаём ProviderPool (пустой)
    ↓
Создаём TriggerController(providerPool)
    ↓
TriggerController читает все триггеры из БД TriggerService (работа с БД) 
    ↓
Для каждого триггера: providerPool.get(providerName)
    ↓
ProviderPool лениво создаёт провайдер (если нет)
    ↓
Провайдер стартует → триггер регистрируется → события идут в handlers
```

---

💡 Такой дизайн решает сразу несколько задач:

* Провайдеры переиспользуются между триггерами.
* Подключения лениво создаются (экономия ресурсов).
* Конфиги централизованы в базе.
* Логика запуска в одном месте (контроллер).

 