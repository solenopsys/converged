import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function RequestQr({ url }: { url: string }) {
	const [dataUrl, setDataUrl] = useState("");

	useEffect(() => {
		let active = true;
		void QRCode.toDataURL(url, {
			width: 220,
			margin: 1,
			errorCorrectionLevel: "M",
			color: { dark: "#101827", light: "#ffffff" },
		})
			.then((next) => {
				if (active) setDataUrl(next);
			})
			.catch(() => {
				if (active) setDataUrl("");
			});
		return () => {
			active = false;
		};
	}, [url]);

	return (
		<div className="rounded-2xl border border-white/10 bg-white p-3 shadow-2xl shadow-black/30">
			{dataUrl ? (
				<img src={dataUrl} alt="Request QR" className="h-44 w-44" />
			) : (
				<div className="flex h-44 w-44 items-center justify-center bg-slate-100 text-xs text-slate-500">
					QR
				</div>
			)}
		</div>
	);
}
