// Analytics counters / tracking pixels configuration, per tenant (scope).
//
// The service currently stores counter *codes* (tracking ids) so that SSR
// landings can inject the right analytics snippets per tenant. See the service
// README for the extended roadmap (acting as an API integration proxy, e.g. for
// the Google Analytics Data API, to pull and persist metrics).

export type CounterType =
	| "google-analytics" // GA4, gtag.js  (trackingId = "G-XXXXXXXX")
	| "google-tag-manager" // GTM         (trackingId = "GTM-XXXXXXX")
	| "yandex-metrika" // Yandex.Metrika  (trackingId = numeric id)
	| "facebook-pixel" // Meta Pixel      (trackingId = numeric id)
	| "custom"; // arbitrary head snippet (headSnippet)

export type Counter = {
	id: string; // stable key, e.g. "google-analytics"
	type: CounterType;
	trackingId?: string; // measurement / container / pixel id
	enabled: boolean;
	headSnippet?: string; // used when type === "custom": raw <script> for <head>
	createdAt?: string;
	updatedAt?: string;
};

export type CounterInput = {
	id: string;
	type: CounterType;
	trackingId?: string;
	enabled?: boolean; // defaults to true on create
	headSnippet?: string;
};

export interface CountersService {
	// Read (public): SSR landing reads enabled counters for the current scope.
	listCounters(): Promise<Counter[]>;
	listEnabled(): Promise<Counter[]>;
	getCounter(id: string): Promise<Counter | null>;

	// Write (authenticated): admin/configurator manages the counter codes.
	upsertCounter(input: CounterInput): Promise<Counter>;
	deleteCounter(id: string): Promise<void>;
}
