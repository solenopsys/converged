export const theme = {
	cellSize: 40,

	nodeRadius: 16,

	nodeSpacing: 40,

	leftMargin: 40,

	topOffset: 20,

	colors: {
		nodeBackground: "gray",
		nodeSelected: "hsl(var(--accent))",
		nodeBorder: "gray",
		nodeText: "white",

		entryPoint: "hsla(120, 100%, 50%, 0.7)",
		exitPoint: "hsla(0, 100%, 50%, 0.7)",
		connectionDefault: "hsl(var(--muted))",
		connectionIncoming: "hsl(120, 100%, 50%)",
		connectionOutgoing: "hsl(0, 100%, 50%)",
	},

	sizes: {
		nodeBorderWidth: 2,
		connectionPointRadius: 4,
		connectionWidth: 2,
		connectionHoveredWidth: 3,
	},

	bezier: {
		baseOffset: 15,
		distanceMultiplier: 15,
	},

	font: "lighter 14px Arial",

	getNodePosition: (index) => ({
		x: theme.leftMargin + theme.cellSize / 2,
		y: theme.topOffset + index * theme.cellSize,
	}),

	getCellBounds: (index) => ({
		left: theme.leftMargin,
		top: theme.topOffset - theme.cellSize / 2 + index * theme.cellSize,
		right: theme.leftMargin + theme.cellSize,
		bottom: theme.topOffset + theme.cellSize / 2 + index * theme.cellSize,
		width: theme.cellSize,
		height: theme.cellSize,
	}),

	validateNodeFitsInCell: () => {
		const maxNodeSize = theme.nodeRadius * 2;
		const availableSpace = theme.cellSize - 8;
		return maxNodeSize <= availableSpace;
	},
};
