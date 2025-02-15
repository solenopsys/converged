import { Component } from "@solenopsys/converged-renderer";
import styles from "./styles/banner.module.css";

interface BannerProps {
	title: string;
	image: string;
}

export const Banner: Component<BannerProps> = (conf: any) => {
	console.log("BANNER", conf);
	return () => (
		<div
			class={styles.banner}
			style={{ backgroundImage: `url(https://zero.node.solenopsys.org/ipfs/${conf.image["/"]})` }} // todo ipfs image component
		>
			<div
				class={`flex items-end justify-center text-center ${styles.banner_title}`}
			>
				{conf.title}
			</div>
		</div>
	);
};
