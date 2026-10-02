import { BaseRepositorySQL, type KeySQL, type SqlStore } from "back-core";
import type { ClientEntity } from "./entities";

interface ClientKey extends KeySQL {
	id: string;
}

export class ClientRepository extends BaseRepositorySQL<
	ClientKey,
	ClientEntity
> {
	constructor(store: SqlStore) {
		super(store, "clients", {
			primaryKey: "id",
			extractKey: ({ id }) => ({ id }),
			buildWhereCondition: ({ id }) => ({ id }),
		});
	}
}
