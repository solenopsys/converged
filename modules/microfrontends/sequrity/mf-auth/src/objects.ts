import { upsertSidebarTab } from "front-core";
import {
	defineMicrofrontend,
	executeOperation,
	objectOf,
	objectRef,
	presentReference,
	setOperationAuthorizationController,
} from "front-core/object-runtime";
import {
	$isAuthenticated,
	authController,
	authenticationRequested,
	ensureTemporarySessionFx,
	logoutPressed,
	temporarySessionRequested,
} from "./model";
import { sendMagicLink } from "./service";
import LoginView from "./views/LoginView";

const loginRef = () => objectRef("auth.session", "login", { title: "Login" });

export default defineMicrofrontend({
	id: "mf-auth",
	types: [
		{
			id: "auth.session",
			label: "Session",
			pluralLabel: "Sessions",
			categories: ["core.security"],
		},
	],
	views: [
		{
			id: "auth.session.login",
			accepts: objectOf("auth.session"),
			component: LoginView,
		},
	],
	operations: [
		{
			id: "auth.session.login",
			operator: "open",
			target: "auth.session",
			label: "Login",
			access: "public",
			output: objectOf("auth.session"),
			presentOutput: true,
			invoke: loginRef,
		},
		{
			id: "auth.session.logout",
			operator: "execute",
			target: "auth.session",
			label: "Logout",
			invoke: () => logoutPressed(),
		},
		{
			id: "auth.session.ensure-temporary",
			operator: "execute",
			target: "auth.session",
			label: "Ensure temporary session",
			access: "public",
			invoke: () => ensureTemporarySessionFx(),
		},
		{
			id: "auth.magic-link.send",
			operator: "execute",
			target: "auth.session",
			label: "Send magic link",
			access: "public",
			parameters: {
				type: "object",
				properties: {
					email: { type: "string", format: "email" },
					returnTo: { type: "string" },
				},
				required: ["email"],
			},
			invoke: ({ params }) =>
				sendMagicLink(
					String(params.email),
					params.returnTo as string | undefined,
				),
		},
	],
	setup: () => {
		setOperationAuthorizationController({
			snapshot: () => authController.snapshot(),
			ensureSession: () => authController.ensureSession(),
			can: (capability) => authController.can(capability),
			subscribe: (listener) => authController.subscribe(listener),
			authenticate: () => presentReference(loginRef()),
		});
		const stopAuth = $isAuthenticated.watch((isAuthenticated) => {
			upsertSidebarTab({
				id: "auth",
				title: isAuthenticated ? "Logout" : "Login",
				iconName: isAuthenticated ? "log-out" : "user",
				order: 10,
			});
		});
		const stopRequest = authenticationRequested.watch(
			() => void presentReference(loginRef()),
		);
		const onDocumentClick = (event: MouseEvent) => {
			const button = (event.target as HTMLElement | null)?.closest?.(
				'[data-tab-id="auth"]',
			);
			if (!button) return;
			if (authController.snapshot().session === "account")
				void executeOperation({ operationId: "auth.session.logout" });
			else void presentReference(loginRef());
		};
		document?.addEventListener("click", onDocumentClick);
		temporarySessionRequested();
		return () => {
			stopAuth();
			stopRequest();
			document?.removeEventListener("click", onDocumentClick);
			setOperationAuthorizationController(null);
		};
	},
});
