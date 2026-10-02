import { BaseRepositorySQL, type KeySQL, type SqlStore } from "back-core";
import type { ContactEntity } from "./entities";

interface ContactKey extends KeySQL {
	id: string;
}

export class ContactRepository extends BaseRepositorySQL<
	ContactKey,
	ContactEntity
> {
	constructor(private readonly store: SqlStore) {
		super(store, "contacts", {
			primaryKey: "id",
			extractKey: ({ id }) => ({ id }),
			buildWhereCondition: ({ id }) => ({ id }),
		});
	}

	listByClientId(clientId: string): Promise<ContactEntity[]> {
		return this.store.db
			.selectFrom("contacts")
			.selectAll()
			.where("clientId", "=", clientId)
			.orderBy("id", "asc")
			.execute() as Promise<ContactEntity[]>;
	}
}
