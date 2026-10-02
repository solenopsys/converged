export interface ClientEntity {
	id: string;
	name: string;
}

export interface ContactEntity {
	id: string;
	clientId: string;
	type: string;
	value: string;
}
