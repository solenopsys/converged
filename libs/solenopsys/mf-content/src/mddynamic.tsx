import { Component, For, usePromise } from "@solenopsys/converged-renderer";
import { MdArticle } from "@solenopsys/ui-content";
import { cascadeFetch } from "./fetcher";

interface Props {
	menuId: string;
}

export const MdDynamic: Component<Props> = (props: any) => {
	const ftch = () => cascadeFetch(props.ipfs);
	const mdData = usePromise<any[]>(ftch);

	return () => {
		const state: any = mdData();
		if (state.pending) return <div></div>;
		const articles = state.value.articles;
		return <MdArticle articles={articles} />;
	};
};
