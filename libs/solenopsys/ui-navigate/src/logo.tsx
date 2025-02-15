import type { Component } from "@solenopsys/converged-renderer";
import { css } from "./css";

// @ts-ignore
import styles from "./styles/logo.module.css";

const logo = css(styles, ".logo");

export type LogoProps = {
	image: string;
	alt: string;
};


export const UiLogo: Component<LogoProps> = (props: LogoProps) => {
	return (<img alt={props.alt} class={logo} src={props.image} />);
};
