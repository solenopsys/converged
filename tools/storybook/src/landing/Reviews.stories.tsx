import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReviewsBlock } from "front-core";
import type { ReactNode } from "react";
import { reviewsData } from "../reviewsDemo";
import { withIslands } from "../ssr/withIslands";

const meta = {
	title: "Landing/Reviews",
	component: ReviewsBlock,
	parameters: { layout: "fullscreen" },
	args: { data: reviewsData },
	render: (args) => (
		<Page>
			<ReviewsBlock {...args} />
		</Page>
	),
} satisfies Meta<typeof ReviewsBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Full-width: featured review on top + horizontal lane (shared carousel). */
export const Desktop: Story = {};

/**
 * Narrow section: the container query folds the lane into a vertical compact
 * list and flattens the featured card — the same component, no second tree.
 */
export const Compact: Story = {
	parameters: { layout: "padded" },
	render: (args) => (
		<Page>
			<div style={{ maxWidth: 380, margin: "0 auto" }}>
				<ReviewsBlock {...args} />
			</div>
		</Page>
	),
};

/** Pure SSR output (static HTML, no interactivity). */
export const SSRStatic: Story = {
	decorators: [withIslands],
	parameters: { ssr: "static" },
};

/** SSR HTML + island hydration — the lane carousel comes alive. */
export const SSRInteractive: Story = {
	decorators: [withIslands],
	parameters: { ssr: "interactive" },
};

function Page({ children }: { children: ReactNode }) {
	return (
		<div
			style={{
				minHeight: "100vh",
				padding: "40px 0",
				background:
					"linear-gradient(180deg, oklch(0.985 0.003 80), oklch(0.95 0.004 80))",
			}}
		>
			{children}
		</div>
	);
}
