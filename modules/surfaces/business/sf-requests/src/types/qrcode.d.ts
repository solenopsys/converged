declare module "qrcode" {
	type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

	export type QRCodeToDataURLOptions = {
		width?: number;
		margin?: number;
		errorCorrectionLevel?: ErrorCorrectionLevel;
		color?: {
			dark?: string;
			light?: string;
		};
	};

	export function toDataURL(
		text: string,
		options?: QRCodeToDataURLOptions,
	): Promise<string>;
}
