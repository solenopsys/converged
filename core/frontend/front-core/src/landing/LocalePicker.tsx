import * as select from "@zag-js/select";
import { normalizeProps, useMachine } from "@zag-js/preact";
import { useId } from "preact/hooks";
import { CheckIcon, ChevronDown, Globe2 } from "../icons";
import {
	AVAILABLE_LANGS,
	DEFAULT_LOCALE,
	isSupportedLocale,
	type SupportedLocale,
} from "./i18n";

type Language = (typeof AVAILABLE_LANGS)[number];

const languageCollection = select.collection({
	items: AVAILABLE_LANGS,
	itemToValue: (item: Language) => item.code,
	itemToString: (item: Language) => item.name,
});

export function LocalePicker({
	locale,
	onLocaleChange,
}: {
	locale?: string;
	onLocaleChange: (locale: SupportedLocale) => void;
}) {
	const currentLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
	const service = useMachine(select.machine, {
		id: useId(),
		collection: languageCollection,
		value: [currentLocale],
		positioning: { placement: "bottom-end", gutter: 8 },
		onValueChange: ({ value }) => {
			const nextLocale = value[0];
			if (!isSupportedLocale(nextLocale) || nextLocale === currentLocale) return;
			onLocaleChange(nextLocale);
		},
	});
	const api = select.connect(service, normalizeProps);

	return (
		<div class="top-bar-language" {...api.getRootProps()}>
			<span class="top-bar-language-label" {...api.getLabelProps()}>
				Change language
			</span>
			<select {...api.getHiddenSelectProps()} />
			<div {...api.getControlProps()}>
				<button class="top-bar-language-trigger" {...api.getTriggerProps()} aria-label="Change language">
					<Globe2 size={16} />
					<span {...api.getValueTextProps()}>{currentLocale.toUpperCase()}</span>
					<ChevronDown size={14} />
				</button>
			</div>
			{api.open ? (
				<div class="top-bar-language-positioner" {...api.getPositionerProps()}>
					<div class="top-bar-language-content" {...api.getContentProps()}>
						<div {...api.getListProps()}>
							{AVAILABLE_LANGS.map((language) => (
								<div
									key={language.code}
									class="top-bar-language-option"
									{...api.getItemProps({ item: language })}
								>
									<span {...api.getItemTextProps({ item: language })}>{language.name}</span>
									<span class="top-bar-language-check" {...api.getItemIndicatorProps({ item: language })}>
										<CheckIcon size={14} />
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
