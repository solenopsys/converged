import type { Counter } from "g-counters";
import { Fragment } from "react";

/**
 * Analytics counters / tracking pixels for SSR landings.
 *
 * Counters are per-tenant data owned by ms-counters (g-counters) and resolved by
 * scope at render time — see `resolveCounters`. For single-tenant setups where a
 * counters service is not wired, a Google Analytics id can be supplied via the
 * `ANALYTICS_ID` env var (fallback only).
 *
 * If neither counters nor `ANALYTICS_ID` are present, nothing is rendered, so the
 * same component is safe to drop into any project.
 */
export function AnalyticsScript({
	counters,
	gaId = process.env.ANALYTICS_ID,
}: {
	counters?: Counter[];
	gaId?: string;
} = {}) {
	const list = (counters ?? []).filter((c) => c.enabled);

	// Env fallback: expose the single GA id as a counter when the service isn't wired.
	const fallbackGa = gaId?.trim();
	if (list.length === 0 && fallbackGa) {
		list.push({
			id: "google-analytics",
			type: "google-analytics",
			trackingId: fallbackGa,
			enabled: true,
		});
	}

	if (list.length === 0) return null;

	return (
		<Fragment>
			{list.map((counter) => (
				<CounterTag key={counter.id} counter={counter} />
			))}
		</Fragment>
	);
}

function CounterTag({ counter }: { counter: Counter }) {
	const id = counter.trackingId?.trim();

	switch (counter.type) {
		case "google-analytics": {
			if (!id) return null;
			return (
				<Fragment>
					<script
						async
						src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
					/>
					<script
						dangerouslySetInnerHTML={{
							__html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(id)});`,
						}}
					/>
				</Fragment>
			);
		}
		case "google-tag-manager": {
			if (!id) return null;
			return (
				<script
					dangerouslySetInnerHTML={{
						__html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(id)});`,
					}}
				/>
			);
		}
		case "yandex-metrika": {
			if (!id) return null;
			return (
				<script
					dangerouslySetInnerHTML={{
						__html: `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');ym(${JSON.stringify(id)},'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true});`,
					}}
				/>
			);
		}
		case "facebook-pixel": {
			if (!id) return null;
			return (
				<script
					dangerouslySetInnerHTML={{
						__html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(id)});fbq('track','PageView');`,
					}}
				/>
			);
		}
		case "custom": {
			const snippet = counter.headSnippet?.trim();
			if (!snippet) return null;
			return <script dangerouslySetInnerHTML={{ __html: snippet }} />;
		}
		default:
			return null;
	}
}
