import $ from "@solenopsys/converged-reactive";
import { Component ,usePromise} from "@solenopsys/converged-renderer";
import { UiCodeArea } from "./codearea";


export const UiCodeLoader: Component = (props: {url:string}) => {
    const fetcher =() => fetch(props.url).then((res) => res.text());
	const mdData = usePromise<any[]>(fetcher);

	return () => {
		const state: any = mdData();
		if (state.pending) return <div></div>;
		const code = state.value;
		return  <UiCodeArea value={code} language="javascript" />;
	};

  
};
