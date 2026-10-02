import { BaseService, badRequestError } from "back-core";
import { StoresController } from "./stores";
import type { Client, ClientsService, Contact } from "./types";

class ClientsServiceImpl
	extends BaseService<StoresController>
	implements ClientsService
{
	constructor() {
		super("rp-clients");
	}

	protected createStores(repositoryId: string): StoresController {
		return new StoresController(repositoryId);
	}

	async createClient(client: Client): Promise<Client> {
		await this.ready();
		if (!client.id?.trim() || !client.name?.trim()) {
			throw badRequestError("Client id and name are required");
		}
		return this.stores.clients.create({
			id: client.id.trim(),
			name: client.name.trim(),
		});
	}

	async getClient(id: string): Promise<Client | null> {
		await this.ready();
		if (!id?.trim()) throw badRequestError("Client id is required");
		return (await this.stores.clients.findById({ id: id.trim() })) ?? null;
	}

	async listClients(): Promise<Client[]> {
		await this.ready();
		return this.stores.clients.findAll({
			orderBy: [{ field: "name", direction: "asc" }],
		});
	}

	async updateClient(id: string, name: string): Promise<Client | null> {
		await this.ready();
		if (!id?.trim() || !name?.trim()) {
			throw badRequestError("Client id and name are required");
		}
		return (
			(await this.stores.clients.update(
				{ id: id.trim() },
				{ name: name.trim() },
			)) ?? null
		);
	}

	async deleteClient(id: string): Promise<boolean> {
		await this.ready();
		if (!id?.trim()) throw badRequestError("Client id is required");
		return this.stores.clients.delete({ id: id.trim() });
	}

	async createContact(contact: Contact): Promise<Contact> {
		await this.ready();
		if (
			!contact.id?.trim() ||
			!contact.clientId?.trim() ||
			!contact.type?.trim() ||
			!contact.value?.trim()
		) {
			throw badRequestError(
				"Contact id, clientId, type and value are required",
			);
		}
		if (
			!(await this.stores.clients.findById({ id: contact.clientId.trim() }))
		) {
			throw badRequestError(`Client not found: ${contact.clientId}`);
		}
		return this.stores.contacts.create({
			id: contact.id.trim(),
			clientId: contact.clientId.trim(),
			type: contact.type.trim(),
			value: contact.value.trim(),
		});
	}

	async getContact(id: string): Promise<Contact | null> {
		await this.ready();
		if (!id?.trim()) throw badRequestError("Contact id is required");
		return (await this.stores.contacts.findById({ id: id.trim() })) ?? null;
	}

	async listContacts(clientId: string): Promise<Contact[]> {
		await this.ready();
		if (!clientId?.trim()) throw badRequestError("Client id is required");
		return this.stores.contacts.listByClientId(clientId.trim());
	}

	async updateContact(
		id: string,
		patch: Partial<Pick<Contact, "type" | "value">>,
	): Promise<Contact | null> {
		await this.ready();
		if (!id?.trim()) throw badRequestError("Contact id is required");
		const update: Partial<Contact> = {};
		if (patch.type !== undefined) update.type = patch.type.trim();
		if (patch.value !== undefined) update.value = patch.value.trim();
		return (
			(await this.stores.contacts.update({ id: id.trim() }, update)) ?? null
		);
	}

	async deleteContact(id: string): Promise<boolean> {
		await this.ready();
		if (!id?.trim()) throw badRequestError("Contact id is required");
		return this.stores.contacts.delete({ id: id.trim() });
	}
}

export default ClientsServiceImpl;
