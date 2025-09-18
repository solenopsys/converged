Извините за путаницу! Я попытался обновить существующий код, но это было неуместно. Позвольте объяснить текстом, как добавить логгирование на все события домена.

В Effector есть несколько способов добавить логгирование на все события внутри домена:

**Способ 1: Использование `onCreateEvent` хука**
```javascript
eventBusDomain.onCreateEvent(event => {
  event.watch((payload) => {
    console.log(`Событие "${event.compositeName.fullName}" сработало:`, payload);
  });
});
```

Этот хук срабатывает каждый раз, когда в домене создается новое событие, и автоматически подписывается на него для логгирования.

**Способ 2: Использование `onCreateEffect` для эффектов**
```javascript
eventBusDomain.onCreateEffect(effect => {
  effect.watch((params) => {
    console.log(`Эффект "${effect.compositeName.fullName}" запущен:`, params);
  });
  
  effect.done.watch(({ result }) => {
    console.log(`Эффект завершен успешно:`, result);
  });
  
  effect.fail.watch(({ error }) => {
    console.log(`Эффект завершился с ошибкой:`, error);
  });
});
```

**Способ 3: Создание универсального логгера домена**
```javascript
const createDomainLogger = (domain, options = {}) => {
  const { logEvents = true, logEffects = true } = options;

  if (logEvents) {
    domain.onCreateEvent(event => {
      event.watch(payload => console.log(`[${domain.compositeName.fullName}] EVENT:`, event.compositeName.fullName, payload));
    });
  }

  if (logEffects) {
    domain.onCreateEffect(effect => {
      effect.watch(params => console.log(`[${domain.compositeName.fullName}] EFFECT START:`, effect.compositeName.fullName, params));
      effect.done.watch(({ result }) => console.log(`[${domain.compositeName.fullName}] EFFECT SUCCESS:`, result));
      effect.fail.watch(({ error }) => console.log(`[${domain.compositeName.fullName}] EFFECT FAIL:`, error));
    });
  }
};

// Применяем к нашему домену
createDomainLogger(eventBusDomain);
```

Эти хуки нужно добавить **до создания событий и эффектов** в домене, тогда логгирование будет работать автоматически для всех новых единиц домена.