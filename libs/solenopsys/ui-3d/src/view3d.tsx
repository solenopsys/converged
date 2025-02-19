import { Component,useEffect } from "@solenopsys/converged-renderer";
import $ from "@solenopsys/converged-reactive";
import { BasicSceneConfig } from "./scene";
import { load3MF } from "./loaders";

export const View3D: Component = (props: {
	modelUrl: string;
	textureUrl: string;
}) => {
	console.log("VIEV3D PROPS", props);
	const ref = $<HTMLDivElement>();
	let config = new BasicSceneConfig();
	config.loadTexture(props.textureUrl);

	const animate = () => {
		requestAnimationFrame(animate);
		config.render();
	};

	load3MF(props.modelUrl, config.scene);

	useEffect(() => {
    console.log("EFFECT");
		const node = ref();
		if (!node) return;
		console.log("REF OK");
		node.appendChild(config.renderer.domElement);
    animate();
	});

	return (<div style={{ maxWidth: "1000px" }} ref={ref}></div>);
	;
};

export default View3D;
