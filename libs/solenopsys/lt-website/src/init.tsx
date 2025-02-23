import { lazy, render } from "@solenopsys/converged-renderer";

import { Site } from "./layout/site";
import { Router } from "@solenopsys/converged-router";
import { UiEvents } from "@solenopsys/converged-renderer";
import $ from "@solenopsys/converged-reactive";
import { googleOneTap } from "@solenopsys/mf-auth";

function setPageTitle(title:string){
	document.title=title
}

function setFavicon(href:string){
	console.log("FAV HREF",href)
	const link=document.querySelector("link[rel*='shortcut icon']") as HTMLAnchorElement | null
	if(link !== null){
		link.href=href
	}
}




export const createLayout = (
	tagId: string,
	loadModule: (name: string) => {},
	conf: any
) => {
	UiEvents({type:"LayoutInit",tag:tagId})
	console.log("CONF", conf)
	setPageTitle(conf.title)
	setFavicon(conf.favicon._uri)

	$.effect(() => {
		const event:any = UiEvents();
		if (event.type === "external") {
			googleOneTap();
		}
	});


	
	// @ts-ignore
	render(() => {

		console.log("ROUTER INIT")
		return (
			<Router>
				<Site  {...conf}  />
			</Router>
		);
	}, document.getElementById(tagId));
};
