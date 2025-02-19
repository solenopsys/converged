import { If, render } from "@solenopsys/converged-renderer";
import $ from "@solenopsys/converged-reactive";
import { Routes, Route, Router } from "@solenopsys/converged-router";
import LoginComponent from "./pages/login";
import RegisterComponent from "./pages/register";
import ConfirmComponent from "./pages/confirm";
import { UiLogo } from "@solenopsys/ui-navigate";
import styles from "./styles/template.module.scss"

//import { ColorSchemesService } from "@solenopsys/ui-themes";
//const cs = store(ColorSchemesService);
//cs.initColors(ref.style);

function setPageTitle(title: string) {
	document.title = title;
}

function setFavicon(href: string) {
	const link = document.querySelector(
		"link[rel*='shortcut icon']",
	) as HTMLAnchorElement | null;
	if (link !== null) {
		link.href = href;
	}
}

export const createLayout = (
	tagId: string,
	loadModule: (name: string) => {},
	conf: any,
) => {
	const logo = $(conf.page.logo);
	// @ts-ignore
	render(() => {
		return (
			<body class={styles.bodyWrapper}>
				<Router>
					<div class={styles.panel}>
						<UiLogo logo={logo()} />
						<Routes>
							<Route path="/register" element={<RegisterComponent />} />
							<Route path="/" element={<LoginComponent />} />
							<Route path="/confirm" element={<ConfirmComponent />} />
						</Routes>
					</div>
				</Router>
			</body>
		);
	}, document.getElementById(tagId));
};
