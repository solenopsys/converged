import { EntityListView } from "front-core";
import {
	defineSurface,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import { $secretsStore, getSecretFx, openSecretDetail } from "./domain-secrets";
import { secretsColumns } from "./functions/columns";
import { SecretDetailView } from "./views/SecretDetailView";

export default defineSurface({
	id: "sf-secrets",
	label: "Secrets",
	purpose: "Stored credentials and secret values",
	types: [
		{
			id: "secrets.secret",
			label: "Secret",
			pluralLabel: "Secrets",
			categories: [
				"core.security",
				"core.selectable",
				"core.creatable",
				"core.editable",
			],
			infinity: {
				tableId: "secrets",
				title: "Secrets",
				columns: secretsColumns,
				store: $secretsStore,
				rowRef: (row) => objectRef("secrets.secret", String(row.name)),
				filters: [
					{ id: "name", label: "Name", type: "search", operator: "contains" },
				],
			},
		},
	],
	views: [
		{
			id: "secrets.secret.detail",
			accepts: objectOf("secrets.secret"),
			component: SecretDetailView,
			props: (ref) => {
				if (ref.kind === "object") {
					openSecretDetail({ name: ref.id });
					getSecretFx(ref.id);
				}
				return {};
			},
		},
		{
			id: "secrets.secret.table",
			accepts: setOf("secrets.secret"),
			component: EntityListView,
		},
	],
	operations: [],
});
