entity — атом данных, кэшируемый.

resource — операция получения/модификации (возвращает entity или список entity).

view — визуализация сущностей (подписана на store).

controller — оркестрирует вызовы (fetch, act, present).

store — слой в памяти, подписка на entity и resource.

registry — всё вместе, метаданные и связи.