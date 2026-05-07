declare module "qrcode" {
	type QrColor = {
		dark?: string;
		light?: string;
	};

	type QrOptions = {
		width?: number;
		margin?: number;
		errorCorrectionLevel?: "L" | "M" | "Q" | "H";
		color?: QrColor;
	};

	const QRCode: {
		toDataURL(text: string, options?: QrOptions): Promise<string>;
	};

	export default QRCode;
}
