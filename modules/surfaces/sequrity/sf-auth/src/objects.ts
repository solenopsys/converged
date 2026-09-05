import { setActionAuthorizationController, upsertSidebarTab } from "front-core";
import {
	Category,
	defineSurface,
	executeOperation,
	type ObjectDefinition,
	objectOf,
	objectRef,
	presentReference,
	setOperationAuthorizationController,
} from "front-core/object-runtime";
import {
	$isAuthenticated,
	authController,
	authenticationRequested,
	logoutPressed,
	temporarySessionRequested,
} from "./model";
import LoginView from "./views/LoginView";

const loginRef = () => objectRef("auth.session", "login", { title: "Login" });

export const objects = [
	{
		id: "auth.session",
		label: "Session",
		pluralLabel: "Sessions",
		categories: [Category.Security],
		discover: () => authController.snapshot().session !== "account",
	},
] satisfies readonly ObjectDefinition[];

export default defineSurface({
	id: "sf-auth",
	label: "Account",
	purpose: "Signing in and out of the current session",
	types: objects,
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
			discover: () => authController.snapshot().session !== "account",
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
	],
	setup: () => {
		setOperationAuthorizationController({
			snapshot: () => authController.snapshot(),
			ensureSession: () => authController.ensureSession(),
			can: (capability) => authController.can(capability),
			subscribe: (listener) => authController.subscribe(listener),
			authenticate: () => presentReference(loginRef()),
		});
		setActionAuthorizationController({
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
			setActionAuthorizationController(null);
		};
	},
});
