import { Component } from "@solenopsys/converged-renderer";
import $ from "@solenopsys/converged-reactive";
import styles from "./styles/md-view.module.css";
import { Highlight } from "@solenopsys/ui-highlight";

interface MdItemComponentProps {
	key: string;
	data: {
		type: string;
		children: MdItemComponentProps[];
		url: string;
		alt: string;
		value: string;
		params: { [key: string]: string };
	};
}

export const MdView: Component<MdItemComponentProps> = (props) => {
	console.log("MDVIEW", props);
	return (
		<div class={styles.mdview}>
			<MdBlock data={props.data.article}> </MdBlock>
		</div>
	);
};

const MdBlock: Component<MdItemComponentProps> = (props) => {
	const MsgRef = $(
		props.data?.children?.map((item, index) => <MdBlock data={item} />),
	);

	switch (props.data.type) {
		case "root":
			return <>{MsgRef()}</>;
		case "paragraph":
			return <p class={styles.paragraph}>{MsgRef()}</p>;
		case "text":
			return props.data.value;
		case "strong":
			return <b>{MsgRef()}</b>;
		case "heading":
			const depth = props.data.params?.depth || 0;
			switch (depth) {
				case 1:
					return <h1 class={styles.header1}>{MsgRef()}</h1>;
				case 2:
					return <h2 class={styles.header2}>{MsgRef()}</h2>;
				case 3:
					return <h3 class={styles.header3}>{MsgRef()}</h3>;
				case 4:
					return <h4 class={styles.header4}>{MsgRef()}</h4>;
				default:
					return <h1 class={styles.header1}>{MsgRef()}</h1>;
			}

		case "list":
			return <ul>{MsgRef()}</ul>;

		case "link":
			console.log("LINK", props);
			return <a href={props.data.value}>{MsgRef()}</a>;
		case "code":
			return (
				<Highlight
					code={props.data.value}
					language={"typescript"}
					inline={false}
				/>
			);
		case "inlineCode":
			return (
				<Highlight
					code={props.data.value}
					language={"typescript"}
					inline={true}
				/>
			);
		case "listItem":
			return <li>{MsgRef()}</li>;

		case "image":
			return (
				<img
					style="max-width: 800px"
					src={"https://zero.node.solenopsys.org/ipfs/" + props.data.cid}
					alt={props.data.alt}
				/>
			);
		case "table":
			return <table>{MsgRef()}</table>;
		case "tableRow":
			return <tr style="width: 50%">{MsgRef()}</tr>;
		case "tableCell":
			return <td>{MsgRef()}</td>;
		default:
			return <div style="color:red;">{props.data.type}</div>;
	}
};
