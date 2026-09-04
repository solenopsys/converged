import {
	defineSurface,
	objectOf,
	setOf,
} from "front-core/object-runtime";
import { SecretDetailView } from "./views/SecretDetailView";
import { SecretsListView } from "./views/SecretsListView";

export default defineSurface({
	id: "sf-secrets",
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
		},
	],
	views: [
		{
			id: "secrets.secret.detail",
			accepts: objectOf("secrets.secret"),
			component: SecretDetailView,
		},
		{
			id: "secrets.secret.table",
			accepts: setOf("secrets.secret"),
			component: SecretsListView,
		},
	],
	operations: [],
});
