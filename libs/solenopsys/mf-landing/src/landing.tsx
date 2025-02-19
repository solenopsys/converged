import { Component, Dynamic, For, usePromise, DynamicLazy } from "@solenopsys/converged-renderer";

export async function ipfsFetch(cid: string) {
	return await (await fetch(`/cached?cid=${cid}`)).json();
}

export const HwLanding: Component = (props: any) => {
	const ftch = () => ipfsFetch(props.ipfs);
	const confData = usePromise<any[]>(ftch);
	return () => {
		const config: any = confData();
		if (config.pending) return <div></div>;

		const res:{component:string,data:any}[] = config.value;
		console.log("RES", res);

		return (
			<>

			<For values={res}>
				{(item: any) => (
					<div class="flex items-center justify-center ">
						<DynamicLazy component={item.component} props={item.data}></DynamicLazy>
					</div>
				)}
			</For>




				{/* <div class="flex items-center justify-center ">
			<Banner image={banner.image} title={banner.title}></Banner>
				<div class="flex flex-col ">
					<TilesGroup title={"Frameworks for Ecosystem"} tiles={frameworks}></TilesGroup>
					<TilesGroup title={"Ecosystem parts"} tiles={ecosistem}></TilesGroup>
				</div>
			</div> */}
			</>
		);
	};
};
