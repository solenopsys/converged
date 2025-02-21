
function setPageTitle(title:string){
	document.title=title
}

function setFavicon(href:string){
	const link=document.querySelector("link[rel*='shortcut icon']") as HTMLAnchorElement | null
	if(link !== null){
		link.href=href
	}
}


export { createLayout } from "./init";

document.documentElement.style.setProperty(`--control-color`, "blue");
//document.documentElement.style.setProperty(`--main-bg-color`, "white");
