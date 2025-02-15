import $ from "@solenopsys/converged-reactive";
import { Component } from "@solenopsys/converged-renderer";

export const UiSelectField: Component = (props: any) => {
	const value = $(props.value || {});
	const titleInf = $("");
	const visible = $(false);
	const dataProvider = $.store({ ...props.dataProvider });
	const filteredEntities = $([]);
	const strObservable = $("");

	$.effect(() => {
		filteredEntities(
			$.untrack(() => dataProvider.initObserver(strObservable())),
		);
	});

	$.effect(() => {
		visible(strObservable() !== "");
	});

	titleInf(value()?.title);

	const handleInputChange = (event: any) => {
		strObservable(event.target.value);
		titleInf(event.target.value);
	};

	const handleFocus = () => {
		strObservable(titleInf());
	};

	const selectEntity = (entity: any) => {
		console.log("UID", entity);
		value(entity);
		titleInf(entity.title);
		console.log("TITLE", titleInf());
		props.valueChange(value());
		visible(false);
	};

  // todo onClickOutside={() => visible(false)}

	return (
		<div > 
			<input
				type="text"
				value={titleInf()}
				onInput={handleInputChange}
				onFocus={handleFocus}
				style={{ width: props.width + "px" }}
			/>
			<div
				class="menu-box"
				style={{
					visibility: visible() ? "visible" : "hidden",
					width: props.width + "px",
				}}
			>
				{filteredEntities().map((entity: any) => (
					<div class="item" onClick={() => selectEntity(entity)}>
						{entity.title}
					</div>
				))}
			</div>
		</div>
	);
};
