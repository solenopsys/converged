import { Access } from "nrpc";
import { StoresController } from "./stores";
import type {
	AuthMethod,
	IdentityService,
	Invite,
	InviteInput,
	InviteList,
	InviteListParams,
	User,
	UserInput,
	UserUpdate,
} from "./types";

// Identity records are managed by auth and other trusted services only. User
// JWTs must not be able to enumerate or mutate identity data directly.
@Access("internal")
export class IdentityServiceImpl implements IdentityService {
	private stores: StoresController;
	private initPromise?: Promise<void>;

	constructor() {
		this.init();
	}

	private async init() {
		if (this.initPromise) {
			return this.initPromise;
		}
		this.initPromise = (async () => {
			this.stores = new StoresController("rp-identity");
			await this.stores.init();
		})();
		return this.initPromise;
	}

	private async ready(): Promise<void> {
		await this.init();
	}

	async createUser(user: UserInput): Promise<User> {
		await this.ready();
		return this.stores.users.createUser(user);
	}

	async listUsers(): Promise<User[]> {
		await this.ready();
		return this.stores.users.listUsers();
	}

	async getUser(userId: string): Promise<User | null> {
		await this.ready();
		return this.stores.users.getUser(userId);
	}

	async getUserByEmail(email: string): Promise<User | null> {
		await this.ready();
		return this.stores.users.getUserByEmail(email);
	}

	async updateUser(userId: string, updates: UserUpdate): Promise<User> {
		await this.ready();
		return this.stores.users.updateUser(userId, updates);
	}

	async deleteUser(userId: string): Promise<boolean> {
		await this.ready();
		return this.stores.users.deleteUser(userId);
	}

	async linkAuthMethod(
		userId: string,
		provider: string,
		providerUserId: string,
		email: string,
	): Promise<void> {
		await this.ready();
		await this.stores.users.linkAuthMethod(
			userId,
			provider,
			providerUserId,
			email,
		);
	}

	async unlinkAuthMethod(userId: string, provider: string): Promise<void> {
		await this.ready();
		await this.stores.users.unlinkAuthMethod(userId, provider);
	}

	async getAuthMethodByProvider(
		provider: string,
		providerUserId: string,
	): Promise<AuthMethod | null> {
		await this.ready();
		return this.stores.users.getAuthMethodByProvider(provider, providerUserId);
	}

	async getUserAuthMethods(userId: string): Promise<AuthMethod[]> {
		await this.ready();
		return this.stores.users.getUserAuthMethods(userId);
	}

	async createInvite(input: InviteInput): Promise<Invite> {
		await this.ready();
		return this.stores.users.createInvite(input);
	}

	/**
	 * Three of the invitation methods are console data, not identity secrets.
	 *
	 * The class is `internal` because a browser must never be able to enumerate
	 * or edit users. But "who has been invited and did their letter arrive" is a
	 * column on a screen, and routing it through a workflow would mean a workflow
	 * per table refresh. So these three are opened to a user token and gated the
	 * ordinary way — by the grant `rp/identity/listInvites(r)`, which lives in
	 * the owner and manager preset files and nowhere else.
	 *
	 * `createInvite` is deliberately not among them: minting one carries the
	 * choice of role, and that guard stays in wf-team-invite where it is written
	 * once.
	 */
	@Access("user")
	async listInvites(params?: InviteListParams): Promise<InviteList> {
		await this.ready();
		return this.stores.users.listInvites(params ?? {});
	}

	@Access("user")
	async getInvite(id: string): Promise<Invite | null> {
		await this.ready();
		return this.stores.users.getInvite(id);
	}

	async getInviteByEmail(email: string): Promise<Invite | null> {
		await this.ready();
		return this.stores.users.getInviteByEmail(email);
	}

	async markInviteSent(id: string): Promise<Invite | null> {
		await this.ready();
		return this.stores.users.markInviteSent(id);
	}

	@Access("user")
	async revokeInvite(id: string): Promise<Invite | null> {
		await this.ready();
		return this.stores.users.revokeInvite(id);
	}

	async consumeInvite(email: string): Promise<Invite | null> {
		await this.ready();
		return this.stores.users.consumeInvite(email);
	}
}

export default IdentityServiceImpl;
