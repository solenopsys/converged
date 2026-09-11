import { getIconByName } from "../icons";

export type TopBarCommand = {
	id: string;
	label: string;
	href: string;
	icon: string;
	external?: boolean;
};

let commands: TopBarCommand[] = [];

export function registerTopBarCommands(next: TopBarCommand[]): void {
	commands = [...next];
}

export function getTopBarCommands(): TopBarCommand[] {
	return commands;
}

export function TopBarCommands() {
	if (commands.length === 0) return null;
	return (
		<>
			{commands.map((command) => {
				const Icon = getIconByName(command.icon);
				const external = command.external ?? /^https?:\/\//.test(command.href);
				return (
					<a
						key={command.id}
						class="top-bar-control"
						href={command.href}
						aria-label={command.label}
						title={command.label}
						{...(external
							? { target: "_blank", rel: "noopener noreferrer" }
							: {})}
					>
						{Icon ? (
							<Icon size={16} aria-hidden="true" />
						) : (
							<span class="top-bar-locale">{command.label}</span>
						)}
					</a>
				);
			})}
		</>
	);
}
