import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type IconSet = {
	icons: Record<string, { body: string; width?: number; height?: number }>;
};


const LEFT_SIDEBAR = "interface-layout-9-column-layout-layouts-left-sidebar";
const RIGHT_SIDEBAR = "interface-layout-10-column-layout-layouts-right-sidebar";

const iconByExport = {
	Activity: "interface-setting-gauge-dashboard-1-bar-speed-test-loading-dashboard-internet-gauge-progress",
	AlertCircle: "interface-alert-information-circle-information-frame-info-more-help-point-circle",
	AlertTriangle: "interface-alert-warning-triangle-frame-alert-warning-triangle-exclamation-caution",
	Archive: "archive-box",
	ArrowDown: "arrow-down-2",
	ArrowLeft: "arrow-round-left",
	ArrowRightFromLine: "interface-arrows-button-to-right-arrow-line-to-right",
	ArrowUp: "arrow-up-1",
	ArrowUpDown: "arrow-curvy-up-down-1",
	BadgeCheck: "interface-validation-check-circle-checkmark-addition-circle-success-check-validation-add-form",
	Ban: "interface-block-remove-circle-garbage-trash-delete",
	BarChart3: "money-graph-bar-product-data-bars-analysis-analytics-graph-business-chart",
	Bot: "computer-robot-cyborg-artificial-robotics-robot-intelligence-machine-technology-android",
	Braces: "braces-circle",
	Building2: "building-2",
	Calendar: "blank-calendar",
	CalendarClock: "circle-clock",
	Check: "check",
	CheckCircle: "interface-validation-check-circle-checkmark-addition-circle-success-check-validation-add-form",
	CheckCircle2: "interface-validation-check-circle-checkmark-addition-circle-success-check-validation-add-form",
	CheckIcon: "check",
	CheckSquare: "check-square",
	ChevronDown: "interface-arrows-button-down-arrow-down-keyboard",
	ChevronDownIcon: "interface-arrows-button-down-arrow-down-keyboard",
	ChevronLeft: "arrow-round-left",
	ChevronRight: "interface-arrows-button-right-arrow-right-keyboard",
	ChevronRightIcon: "interface-arrows-button-right-arrow-right-keyboard",
	CircleIcon: "circle",
	CircleUserRound: "user-circle-single",
	ClipboardCheck: "clipboard-check",
	ClipboardList: "interface-file-clipboard-work-plain-clipboard-task-list-company-office",
	Clock: "circle-clock",
	Copy: "copy-paste",
	Cpu: "computer-chip-1-computer-device-chip-electronics-cpu-microprocessor",
	Database: "database",
	Download: "download-file",
	Factory: "industry-innovation-and-infrastructure",
	FileDown: "download-file",
	FileStack: "new-file",
	FileText: "interface-file-text-text-common-file",
	Form: "interface-file-clipboard-text-edition-form-task-checklist-edit-clipboard",
	FileWarning: "cloud-warning",
	Gauge: "interface-setting-gauge-dashboard-1-bar-speed-test-loading-dashboard-internet-gauge-progress",
	Globe: "travel-map-earth-1-planet-earth-globe-world",
	Globe2: "travel-map-earth-2-planet-earth-globe-world",
	GripVertical: "split-vertical",
	Hand: "hand-cursor",
	HardDrive: "hard-drive-1",
	Hash: "sign-hashtag",
	History: "medical-files-report-history",
	KeyRound: "key",
	ListTree: "tree-2",
	Loader2: "interface-arrows-synchronize-arrows-loading-load-sync-synchronize-arrow-reload",
	LogIn: "login-1",
	LogOut: "logout-1",
	Mail: "mail-send-envelope",
	MailCheck: "mail-send-envelope",
	Map: "map-fold",
	MapPin: "travel-map-location-pin-navigation-map-maps-pin-gps-location",
	Menu: "interface-setting-menu-1-button-parallel-horizontal-lines-menu-navigation-three-hamburger",
	MessageCircle: "chat-bubble-oval",
	MessageSquare: "mail-chat-bubble-square-messages-message-bubble-chat-square",
	MessagesSquare: "mail-chat-bubble-square-messages-message-bubble-chat-square",
	Mic: "computer-voice-mail-mic-audio-mike-music-microphone",
	MicOff: "computer-voice-mail-off-mic-audio-mike-music-microphone-mute-off",
	Monitor: "code-monitor-1",
	Moon: "interface-weather-cresent-moon-1-night-new-moon-crescent-weather-time-waning",
	MoreHorizontal: "interface-setting-menu-1-button-parallel-horizontal-lines-menu-navigation-three-hamburger",
	Network: "network",
	PackageCheck: "shipping-box-1",
	PanelLeftClose: RIGHT_SIDEBAR,
	PanelLeftCloseIcon: RIGHT_SIDEBAR,
	PanelLeftIcon: LEFT_SIDEBAR,
	PanelLeftOpen: LEFT_SIDEBAR,
	PanelRightClose: LEFT_SIDEBAR,
	PanelRightCloseIcon: LEFT_SIDEBAR,
	PanelRightIcon: RIGHT_SIDEBAR,
	PanelRightOpen: RIGHT_SIDEBAR,
	Paperclip: "paperclip-1",
	Pause: "button-pause-2",
	Percent: "discount-percent-badge",
	Phone: "phone",
	PhoneCall: "phone",
	PhoneOff: "computer-voice-mail-off-mic-audio-mike-music-microphone-mute-off",
	Pin: "location-pin-3",
	Play: "button-play",
	Plus: "add-1",
	Printer: "printer",
	RefreshCw: "interface-arrows-synchronize-arrows-loading-load-sync-synchronize-arrow-reload",
	Reply: "discussion-converstion-reply",
	RotateCcw: "rotate-angle-45",
	Ruler: "interface-edit-ruler-ruler-company-office-supplies-work",
	Save: "interface-content-save-disk-floppy-electronics-device-disc-computer",
	Search: "interface-search-glass-search-magnifying",
	Send: "send-email",
	SendHorizontal: "send-email",
	ShieldAlert: "shield-1",
	Square: "button-stop",
	Sun: "interface-lighting-brightness-1-bright-adjust-brightness-adjustment-sun-raise-controls",
	Target: "target",
	Table: "interface-edit-grid-grid-layout-layouts-module",
	Trash2: "interface-delete-bin-1-remove-delete-empty-bin-trash-garbage",
	Tool: "interface-setting-tool-box-box-briefcase-tool-settings",
	Upload: "upload-file",
	User: "user-circle-single",
	Users: "user-multiple-group",
	Wrench: "wrench",
	X: "delete-1",
	XCircle: "interface-delete-3-remove-circle-garbage-trash-delete",
} as const;

const iconSetPath = fileURLToPath(
	import.meta.resolve("@iconify-json/streamline/icons.json"),
);
const { icons } = (await Bun.file(iconSetPath).json()) as IconSet;
const selected = Object.fromEntries(
	Object.entries(iconByExport).map(([exportName, iconName]) => {
		const icon = icons[iconName];
		if (!icon) throw new Error(`Missing Streamline icon: ${iconName}`);
		return [exportName, icon];
	}),
);

const aliases = `// Compatibility with persisted Tabler-style icon names.\nconst TABLER_NAME_ALIASES: Record<string, keyof typeof streamlineUiIconData> = {\n\tIconActivity: "Activity",\n\tIconAi: "Bot",\n\tIconBuilding: "Building2",\n\tIconCalendar: "Calendar",\n\tIconChartBar: "BarChart3",\n\tIconChevronDown: "ChevronDown",\n\tIconChevronLeft: "ChevronLeft",\n\tIconChevronRight: "ChevronRight",\n\tIconCircleCheckFilled: "CheckCircle",\n\tIconClock: "Clock",\n\tIconCode: "Braces",\n\tIconDatabase: "Database",\n\tIconDots: "MoreHorizontal",\n\tIconDotsVertical: "MoreHorizontal",\n\tIconFileText: "FileText",\n\tIconGauge: "Gauge",\n\tIconGitBranch: "Network",\n\tIconGlobe: "Globe",\n\tIconGripVertical: "GripVertical",\n\tIconKey: "KeyRound",\n\tIconLayoutDashboard: "Gauge",\n\tIconListDetails: "ClipboardList",\n\tIconLoader: "Loader2",\n\tIconLogout: "LogOut",\n\tIconMail: "Mail",\n\tIconMapPin: "MapPin",\n\tIconMessages: "MessageSquare",\n\tIconNotification: "AlertCircle",\n\tIconPhone: "Phone",\n\tIconRobot: "Bot",\n\tIconSchema: "Braces",\n\tIconServer: "HardDrive",\n\tIconTarget: "Target",\n\tIconTrash: "Trash2",\n\tIconUser: "User",\n\tIconUserCircle: "CircleUserRound",\n\tIconUsers: "Users",\n\tIconWebhook: "Network",\n\tIconWorld: "Globe2",\n};\n\nexport function getIconByName(name: string): StreamlineIcon | null {\n\tconst direct = (streamlineUiIconData as Record<string, unknown>)[name]\n\t\t? (name as keyof typeof streamlineUiIconData)\n\t\t: undefined;\n\tconst resolved = direct ?? TABLER_NAME_ALIASES[name];\n\treturn resolved ? createIcon(resolved) : null;\n}`;

const exports = [
	aliases,
	...Object.keys(iconByExport).map(
		(name) => `export const ${name} = createIcon("${name}");`,
	),
].join("\n");
const output = `// Generated by tools/generate-streamline-icons.ts. Do not edit manually.\nimport type { ComponentType, JSX } from "preact";\n\nexport type StreamlineIcon = ComponentType<StreamlineIconProps>;\n\n\nexport type StreamlineIconProps = Omit<\n\tJSX.SVGAttributes<SVGSVGElement>,\n\t"strokeWidth" | "stroke-width"\n> & { size?: number | string };\n\nexport const streamlineUiIconData = ${JSON.stringify(selected)} as const;\n\nfunction createIcon(name: keyof typeof streamlineUiIconData): StreamlineIcon {\n\tconst icon = streamlineUiIconData[name];\n\treturn ({ size = 16, ...props }) => (\n\t\t<svg\n\t\t\t{...props}\n\t\t\twidth={size}\n\t\t\theight={size}\n\t\t\tviewBox={\`0 0 \${icon.width ?? 14} \${icon.height ?? 14}\`}\n\t\t\taria-hidden={props[\"aria-label\"] ? undefined : true}\n\t\t\tfocusable=\"false\"\n\t\t\tdangerouslySetInnerHTML={{ __html: icon.body }}\n\t\t/>\n\t);\n}\n\n${exports}\n`;

await Bun.write(resolve(import.meta.dir, "..", "src", "icons", "index.tsx"), output);
