export type ISODateString = string;

export type User = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
  preset?: string;
  /** Language of everything addressed to this person. Falls back to the
   *  company language and then to `en` — a user row is where the chain starts. */
  lang?: string;
  createdAt: ISODateString;
}

export type UserInput = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified?: boolean;
  preset?: string;
  lang?: string;
}

export type UserUpdate = {
  email?: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
  preset?: string;
  lang?: string;
}

/**
 * An invitation carries no token of its own.
 *
 * `rp-auth` already mints one-shot magic links, and a second one-shot link is a
 * second way into the console — one more thing to expire, to throttle and to
 * close. So an invite says something narrower and more useful: *this address is
 * allowed in, and this is the role it gets on arrival.* Re-sending is just
 * another magic link to the same address; the invite itself does not change.
 */
export type InviteStatus =
  | "pending"
  | "sent"
  | "accepted"
  | "revoked"
  | "expired";

export type Invite = {
  id: string;
  email: string;
  name?: string;
  /** The access preset linked on first sign-in. A role is a preset file. */
  preset: string;
  /** Group tags granted alongside the preset, `tg/<tag>` in the grant tree. */
  tags: string[];
  invitedBy: string;
  status: InviteStatus;
  expiresAt: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  /** When the address actually got a letter, for the delivery column. */
  sentAt?: ISODateString;
  acceptedAt?: ISODateString;
};

export type InviteInput = {
  email: string;
  name?: string;
  preset: string;
  tags?: string[];
  invitedBy: string;
  /** Defaults to 14 days when omitted. */
  expiresAt?: ISODateString;
};

export type InviteListParams = {
  offset?: number;
  limit?: number;
  status?: InviteStatus;
  email?: string;
};

export type InviteList = {
  items: Invite[];
  totalCount: number;
};

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

  /**
   * Who is allowed into this console and with which role.
   *
   * Lives next to users rather than in its own repository because the question
   * it answers is the same one `getUserByEmail` answers — "is this address
   * ours?" — and splitting them would mean the sign-in gate asks two services
   * before it can decide whether to send a letter.
   */
  createInvite(input: InviteInput): Promise<Invite>;
  listInvites(params?: InviteListParams): Promise<InviteList>;
  getInvite(id: string): Promise<Invite | null>;
  /** The one the gate needs: the live invitation for an address, if any. */
  getInviteByEmail(email: string): Promise<Invite | null>;
  markInviteSent(id: string): Promise<Invite | null>;
  revokeInvite(id: string): Promise<Invite | null>;
  /** Called on the first successful sign-in; returns null if nothing was open. */
  consumeInvite(email: string): Promise<Invite | null>;
}
