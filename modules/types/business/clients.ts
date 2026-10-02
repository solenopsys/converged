export interface Client {
	id: string;
	name: string;
}

export interface Contact {
	id: string;
	clientId: string;
	type: string;
	value: string;
}

export interface ClientsService {
	createClient(client: Client): Promise<Client>;
	getClient(id: string): Promise<Client | null>;
	listClients(): Promise<Client[]>;
	updateClient(id: string, name: string): Promise<Client | null>;
	deleteClient(id: string): Promise<boolean>;
	createContact(contact: Contact): Promise<Contact>;
	getContact(id: string): Promise<Contact | null>;
	listContacts(clientId: string): Promise<Contact[]>;
	updateContact(
		id: string,
		patch: Partial<Pick<Contact, "type" | "value">>,
	): Promise<Contact | null>;
	deleteContact(id: string): Promise<boolean>;
}
