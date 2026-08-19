declare module "audit" {
	export const hasAuditPage: boolean;
	export function bootstrapAudit(): void;
	export function bootstrapAuditPrint(): void;
}
