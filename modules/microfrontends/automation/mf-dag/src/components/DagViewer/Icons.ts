import { streamlineUiIconData } from "front-core";

export interface IconDefinition {
	body: string;
	width?: number;
	height?: number;
}

export interface NodePosition {
	x: number;
	y: number;
}

export interface Node {
	letter: string;
	iconName?: string;
	label?: string;
	data?: unknown;
}

export interface Connection {
	from: number;
	to: number;
}

export interface State {
	nodes: Node[];
	connections: Connection[];
}

const icon = (name: keyof typeof streamlineUiIconData): IconDefinition =>
	streamlineUiIconData[name];


export const STREAMLINE_ICONS: Record<string, IconDefinition> = {
	circle: icon("CircleIcon"),
	square: icon("Square"),
	triangle: icon("AlertTriangle"),
	database: icon("Database"),
	server: icon("Network"),
	hardDrive: icon("HardDrive"),
	user: icon("User"),
	users: icon("Users"),
	userCheck: icon("CheckCircle"),
	home: icon("Building2"),
	settings: icon("Wrench"),
	menu: icon("Menu"),
	plus: icon("Plus"),
	minus: icon("ArrowDown"),
	edit: icon("Braces"),
	trash: icon("Trash2"),
	copy: icon("Copy"),
	check: icon("Check"),
	x: icon("X"),
	alert: icon("AlertTriangle"),
	info: icon("AlertCircle"),
	arrowUp: icon("ArrowUp"),
	arrowDown: icon("ArrowDown"),
	arrowLeft: icon("ArrowLeft"),
	arrowRight: icon("ChevronRight"),
	file: icon("FileText"),
	folder: icon("Archive"),
	star: icon("BadgeCheck"),
	heart: icon("Target"),
	search: icon("Search"),
	mail: icon("Mail"),
	calendar: icon("Calendar"),
};
