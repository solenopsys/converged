import { describe, it, beforeAll, expect, jest } from "bun:test";


import { render, } from "@solenopsys/converged-renderer";
import { tick } from "@solenopsys/converged-reactive";
import { UiTabs } from "../src/tabs";

describe("UiTabs", () => {
	it("render", async () => {
		const tabClickHandler = jest.fn();
		const tabs = [
			{ id: "tab1", title: "Tab 1" },
			{ id: "tab2", title: "Tab 2" },
			{ id: "tab3", title: "Tab 3" },
		];

		render(
			UiTabs({ selected: "tab2", tabs, tabClick: tabClickHandler }),
			document.body,
		);


       
		const tabElements = document.querySelectorAll("div.tab_style");
 
		
        expect(tabElements.length).toEqual(3);

		const selectedTab = document.querySelector("div.selected");
		expect(selectedTab?.textContent).toEqual("Tab 2");
	
		expect(tabElements[0].textContent).toEqual("Tab 1");


		//  tabElements[0]  .addEventListener("click", ()=>{
		// 	console.log("CLICK IN TEST")
		// 	tabClickHandler("tab1")});
		// 	console.log("BEFORE")
		 tabElements[0] .dispatchEvent(new MouseEvent("click")); 
		 await tick()
		 expect(tabClickHandler).toHaveBeenCalledWith("tab1");
	

		// tabElements[2].dispatchEvent(new KeyboardEvent("keyup"));
		// tick();
		// expect(tabClickHandler).toHaveBeenCalledWith("tab3");
	});
});
