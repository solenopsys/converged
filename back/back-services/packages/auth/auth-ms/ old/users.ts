// все что касается информации о пользователях
// имя пользователя  id  - и группы допустим или теги

// Users микросервис - сущности

interface User {
    id: string; // PK
    email: string; // unique
    username?: string;
    displayName?: string;
    avatarUrl?: string;
    status: 'active' | 'inactive' | 'suspended';
    createdAt: Date;
    updatedAt: Date;
  }