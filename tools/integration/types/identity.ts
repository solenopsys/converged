export type ISODateString = string;

export type User = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
  preset?: string;
  createdAt: ISODateString;
}

export type UserInput = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified?: boolean;
  preset?: string;
}

export type UserUpdate = {
  email?: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
  preset?: string;
}

export type AuthMethod = {
  userId: string;
  provider: string;
  providerUserId: string;
  email: string;
  lastUsedAt: ISODateString;
}

export interface IdentityService {
  createUser(user: UserInput): Promise<User>;
  listUsers(): Promise<User[]>;
  getUser(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUser(userId: string, updates: UserUpdate): Promise<User>;
  deleteUser(userId: string): Promise<boolean>;

  linkAuthMethod(userId: string, provider: string, providerUserId: string, email: string): Promise<void>;
  unlinkAuthMethod(userId: string, provider: string): Promise<void>;
  getAuthMethodByProvider(provider: string, providerUserId: string): Promise<AuthMethod | null>;
  getUserAuthMethods(userId: string): Promise<AuthMethod[]>;
}
