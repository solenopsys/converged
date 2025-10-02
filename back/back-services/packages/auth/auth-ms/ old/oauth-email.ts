

  // OAuth-Email микросервис - сущности

interface MagicLink {
    token: string; // PK
    userId: string;
    email: string;
    expiresAt: Date;
    usedAt?: Date;
    createdAt: Date;
  }