type Options = {
	client_id: string;
	auto_select: boolean;
	cancel_on_tap_outside: boolean;
	context: string;
};

export function googleOneTap(
	options: Options,
	callback: (response: any) => void,
) {
	if (!options.client_id) {
		throw new Error("client_id is required");
	}

	if (typeof window !== "undefined" && window.document) {
		const contextValue = ["signin", "signup", "use"].includes(options.context)
			? options.context
			: "signin";

		const googleScript = document.createElement("script");
		googleScript.src = "https://accounts.google.com/gsi/client";
		googleScript.async = true;
		googleScript.defer = true;
		document.head.appendChild(googleScript);

		googleScript.onload = function () {
			console.log("GOOGLE ONE TAP LOAD", options);
			if (window.google) {
				window.google.accounts.id.initialize({
					client_id: options.client_id,
					callback: callback,
					auto_select: options.auto_select,
					cancel_on_tap_outside: options.cancel_on_tap_outside,
					context: contextValue,
				});
				window.google.accounts.id.prompt();
			}
		};
	}
}
