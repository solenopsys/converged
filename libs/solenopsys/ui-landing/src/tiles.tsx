import { Component, For, If } from "@solenopsys/converged-renderer";
import styles from "./styles/tiles.module.css";

type TileProps = {
	name: string;
	description: string;
	link?: string;
	image?: string;
};

function getImageUrl(image: string) {
	if (!image) return "";
	return `https://zero.node.solenopsys.org/ipfs/${image["/"]}`;
}


export const Tile = (props: TileProps) => {
	return (
		<div
			class={` ${styles.shadow_transition} border-2 rounded-md min-w-[300px]  m-5  min-h-[100px]`}
		>
			<If when={props.image}>
				<img src={getImageUrl(props.image)}  width={300} class="rounded-t-md bottom-0" />
			</If>

			<div class="p-7 ">
				<img src={getImageUrl(props.logo)}   />
				<If when={!props.logo}>
				 <b>{props.name}</b> 
				 </If>
				<div>
					<p>{props.description}</p>
				</div>

				<If when={props.link}>
					<div class="font-size-3">
						<a href={props.link}>Learn more...</a>
					</div>
				</If>
			</div>

			</div>
	);
};

type TilesGroupProps = {
	title: string;
	tiles: TileProps[];
};

export const TilesGroup = (props: TilesGroupProps) => {
	return () => {
		return (
			<div>
				<h2 class="text-center">{props.title}</h2>

				<div class="flex items-center justify-center">
					<div class="flex flex-row flex-wrap  justify-center">
						{props.tiles.map((fw: any) => (
							<Tile {...fw} />
						))}
					</div>
				</div>
			</div>
		);
	};
};
