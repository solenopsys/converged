// OAuth микросервис - сущности

interface OAuthClient {
    clientId: string; // PK
    clientSecret: string;
    clientType: 'public' | 'confidential' | 'internal';
    redirectUris: string[];
  }
  
  interface AccessToken {
    token: string; // PK
    userId: string;
    clientId: string;
    expiresAt: Date;
    scopes: string[];
  }
  
  interface RefreshToken {
    token: string; // PK
    userId: string;
    clientId: string;
    expiresAt: Date;
  }
  
  interface AuthorizationCode {
    code: string; // PK
    userId: string;
    clientId: string;
    expiresAt: Date;
    redirectUri: string;
  }