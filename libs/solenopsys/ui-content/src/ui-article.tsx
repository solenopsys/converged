import styles from "./styles/article.module.css";
import { Component, For } from "@solenopsys/converged-renderer";
import { MdView } from "./ui-md-view";


interface Props {
	articles: { title:string,name:string,data:any }[];
}

export const MdArticle: Component<Props> = (props: any) => {
	return () => {
		
		const articles=props.articles;

		return (
			<div class=" flex flex-col">
				<div class=" p-10">
					<For values={articles}>
						{(article: any) => (
							<>
								<div id={article.name} style="scroll-margin-top: 70px;">
									<MdView data={article} />
								</div>
							</>
						)}
					</For>
				</div>
				<div class={styles.navList}>
					<div class={styles.nav}>
						<For values={articles}>
							{(article: any) => (
								<div id={article.key} class="p-1 font-size-3">
									<a href={"#" + article.name} style="overflow-y: auto;">
										{" "}
										{article.title}
									</a>
								</div>
							)}
						</For>
					</div>
				</div>
			</div>
		);
	};
};
