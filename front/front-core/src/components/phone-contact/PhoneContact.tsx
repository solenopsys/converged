import { PhoneCall } from "lucide-react";
import "./PhoneContact.css";

export interface PhoneContactProps {
	phone?: string;
	onCall?: (phone: string) => void;
	className?: string;
	variant?: "topbar" | "rail";
}

const PHONE_ICON_SIZE = 14;

function normalizePhone(phone?: string): string {
	return typeof phone === "string" ? phone.trim() : "";
}

function toTelHref(phone: string): string {
	const sanitized = phone.replace(/[^\d+]/g, "");
	return `tel:${sanitized || phone}`;
}

export function PhoneContact({
	phone,
	onCall,
	className,
	variant = "topbar",
}: PhoneContactProps) {
	const normalizedPhone = normalizePhone(phone);
	if (!normalizedPhone) return null;

	const rootClass = ["phone-contact", `phone-contact--${variant}`, className]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={rootClass}>
			<a className="phone-contact__link" href={toTelHref(normalizedPhone)}>
				<span className="phone-contact__dot" aria-hidden="true" />
				<span className="phone-contact__value">{normalizedPhone}</span>
			</a>
			{onCall && (
				<button
					className="phone-contact__call"
					type="button"
					aria-label="Call from website"
					title="Call from website"
					onClick={() => onCall(normalizedPhone)}
				>
					<PhoneCall size={PHONE_ICON_SIZE} />
				</button>
			)}
		</div>
	);
}
