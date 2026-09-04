import type { Counter } from "g-counters";
import { Fragment } from "preact/compat";

export function AnalyticsScript({ counters }: { counters: Counter[] }) {
	if (counters.length === 0) return null;

	return (
		<Fragment>
			{counters.map((counter) => (
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
						// biome-ignore lint/security/noDangerouslySetInnerHtml: gtag.js bootstrap, id is JSON-escaped
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
					// biome-ignore lint/security/noDangerouslySetInnerHtml: GTM container loader, id is JSON-escaped
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
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Metrika tag loader, id is JSON-escaped
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
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Meta Pixel loader, id is JSON-escaped
					dangerouslySetInnerHTML={{
						__html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(id)});fbq('track','PageView');`,
					}}
				/>
			);
		}
		case "custom": {
			const snippet = counter.headSnippet?.trim();
			if (!snippet) return null;
			return (
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: operator-authored head snippet from rp-counters
					dangerouslySetInnerHTML={{ __html: snippet }}
				/>
			);
		}
		default:
			return null;
	}
}
