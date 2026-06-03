import { BaseRepositorySQL, type KeySQL } from "back-core";

export interface StringKey extends KeySQL {
	id: string;
}

export interface LeadEntity {
	id: string;
	createdAt: number;
	description: string;
	lang: string;
	type: string;
	catalogId: string;
}

export interface LeadTagEntity {
	leadId: string;
	tagName: string;
	createdAt: number;
}

export interface OfferEntity {
	id: string;
	description: string;
	template_path: string;
}

export interface ContactEntity {
	id: string;
	leadId: string;
	createdAt: number;
	contactType: string;
	value: string;
	role: string;
	description: string;
}

export interface TouchEntity {
	id: string;
	contactId: string;
	createdAt: number;
	description: string;
}

export interface LeadEventEntity {
	id: string;
	code: string;
	type: string;
	contactId: string | null;
	leadId: string | null;
	url: string | null;
	referrer: string | null;
	userAgent: string | null;
	createdAt: number;
}

export class LeadRepository extends BaseRepositorySQL<StringKey, LeadEntity> {}
export class OfferRepository extends BaseRepositorySQL<
	StringKey,
	OfferEntity
> {}
export class ContactRepository extends BaseRepositorySQL<
	StringKey,
	ContactEntity
> {}
export class TouchRepository extends BaseRepositorySQL<
	StringKey,
	TouchEntity
> {}
export class LeadEventRepository extends BaseRepositorySQL<
	StringKey,
	LeadEventEntity
> {}
