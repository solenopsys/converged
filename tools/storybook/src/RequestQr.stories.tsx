import type { Meta, StoryObj } from "@storybook/react-vite";
import { RequestQr } from "../../../front/microfrontends/business/mf-requests/src/components/RequestQr";

const meta = {
	title: "Microfrontends/Requests/RequestQr",
	component: RequestQr,
	parameters: {
		layout: "centered",
	},
	decorators: [
		(Story) => (
			<div className="min-h-screen bg-[#050608] p-8 text-white">
				<Story />
			</div>
		),
	],
	argTypes: {
		url: {
			control: "text",
		},
	},
	args: {
		url: "https://portal.clarity.example/request/01KRM3VH8XOQR3YV41CPY963EZ",
	},
} satisfies Meta<typeof RequestQr>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PublicRequest: Story = {};

export const LocalRequest: Story = {
	args: {
		url: "http://localhost:3000/request/01KRM3VH8XOQR3YV41CPY963EZ",
	},
};

export const LongUrl: Story = {
	args: {
		url: "https://portal.clarity.example/request/01KRM3VH8XOQR3YV41CPY963EZ?workspace=manufacturing&source=assistant%3Arequest",
	},
};
