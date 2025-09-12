export const NODE_TYPE_MAP: Record<string, string> = {
    'start': 'play',
    'get_object': 'database',
    'get_template_types': 'file',
    'get_sender': 'user',
    'ai_select_template_type': 'brain',
    'select_one_template_by_type': 'filter',
    'templateInjectorFooter': 'type',
    'templateInjectorBody': 'edit',
    'templateInjectorSubject': 'mail',
    'randomStringN': 'shuffle',
    'convertHtmlN': 'code',
    'insert_mail': 'send'
  };
  
  export const NODE_DESCRIPTION_MAP: Record<string, string> = {
    'start': 'Начальная точка выполнения workflow',
    'get_object': 'Получение объекта из базы данных',
    'get_template_types': 'Загрузка типов шаблонов',
    'get_sender': 'Получение информации об отправителе',
    'ai_select_template_type': 'ИИ выбор подходящего типа шаблона',
    'select_one_template_by_type': 'Выбор конкретного шаблона по типу',
    'templateInjectorFooter': 'Вставка футера в шаблон',
    'templateInjectorBody': 'Вставка основного содержимого',
    'templateInjectorSubject': 'Формирование темы письма',
    'randomStringN': 'Генерация случайной строки',
    'convertHtmlN': 'Конвертация в HTML формат',
    'insert_mail': 'Сохранение письма в базу данных'
  };
  
  export const DEFAULT_NODE_TYPE = 'circle';
  export const DEFAULT_NODE_DESCRIPTION = 'Описание недоступно';