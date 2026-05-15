import { useParams } from "react-router-dom";

export function RequestPage() {
	const { requestId } = useParams<{ requestId: string }>();

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#050608] p-6 text-white">
			<div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.045] p-6 text-sm leading-6 text-slate-300">
				<div className="text-base font-semibold text-white">
					Открываем заявку
				</div>
				<div className="mt-2 break-all text-slate-400">{requestId}</div>
			</div>
		</div>
	);
}
