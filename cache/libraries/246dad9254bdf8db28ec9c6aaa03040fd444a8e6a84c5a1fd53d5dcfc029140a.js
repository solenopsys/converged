import{If as VN,useMemo as f}from"@solenopsys/converged-renderer";import{useCleanup as $N}from"@solenopsys/converged-renderer";import KN from"@solenopsys/converged-reactive";import{useMemo as t}from"@solenopsys/converged-renderer";import{untrack as AN}from"@solenopsys/converged-reactive";var _N=/^(?:[a-z0-9]+:)?\/\//i,TN=/^\/+/g;function D(N,G=!1){let J=N.replace(TN,"");return J?G||/^[?#]/.test(J)?J:"/"+J:""}function k(N,G,J){if(_N.test(G))return;let K=D(N),Y=J&&D(J),Z="";if(!Y||G.startsWith("/"))Z=K;else if(Y.toLowerCase().indexOf(K.toLowerCase())!==0)Z=K+Y;else Z=Y;return(Z||"/")+D(G,!Z)}function e(N,G){if(N==null)throw new Error(G);return N}function g(N,G){return D(N).replace(/\/*(\*.*)?$/g,"")+D(G)}function NN(N){let G={};return N.searchParams.forEach((J,K)=>{G[K]=J}),G}function O(N,G){return decodeURIComponent(G?N.replace(/\+/g," "):N)}function m(N,G){let[J,K]=N.split("/*",2),Y=J.split("/").filter(Boolean),Z=Y.length;return(W)=>{let U=W.split("/").filter(Boolean),X=U.length-Z;if(X<0||X>0&&K===void 0&&!G)return null;let Q={path:Z?"":"/",params:{}};for(let q=0;q<Z;q++){let H=Y[q],L=U[q];if(H[0]===":")Q.params[H.slice(1)]=L;else if(H.localeCompare(L,void 0,{sensitivity:"base"})!==0)return null;Q.path+=`/${L}`}if(K)Q.params[K]=X?U.slice(-X).join("/"):"";return Q}}function GN(N){let[G,J]=N.pattern.split("/*",2),K=G.split("/").filter(Boolean);return K.reduce((Y,Z)=>Y+(Z.startsWith(":")?2:3),K.length-(J===void 0?0:1))}function v(N){let G=new Map;return new Proxy({},{get(J,K){if(!G.has(K))G.set(K,t(()=>N()[K]));return G.get(K)?.()},getOwnPropertyDescriptor(){return{enumerable:!0,configurable:!0}},ownKeys(){return Reflect.ownKeys(N())}})}function h(N,G){let J=new URLSearchParams(N);Object.entries(G).forEach(([Y,Z])=>{if(Z==null||Z==="")J.delete(Y);else J.set(Y,String(Z))});let K=J.toString();return K?`?${K}`:""}function b(N,G){return t(()=>{return N(),AN(G)})}function JN(N){return[()=>N(),(K)=>N(K)]}function p(N){let G=/(\/?:[^/]+)\?/.exec(N);if(!G)return[N];let J=N.slice(0,G.index),K=N.slice(G.index+G[0].length),Y=[J,J+=G[1]];while(G=/^(\/:[^/]+)\?/.exec(K))Y.push(J+=G[1]),K=K.slice(G[0].length);return p(K).reduce((Z,W)=>[...Z,...Y.map((U)=>U+W)],[])}function YN(N,G,J){return N.addEventListener(G,J),()=>N.removeEventListener(G,J)}function EN(N,G,J){return[G?()=>G(N()):()=>N(),J?(K)=>N(J(K)):N]}function SN(N){try{return document.querySelector(N)}catch(G){return null}}function ZN(N,G){let J=SN(`#${N}`);if(J)J.scrollIntoView();else if(G)window.scrollTo(0,0)}function UN(N,G,J,K){let Y=!1,Z=(U)=>typeof U==="string"?{value:U}:U,W=EN(KN(Z(N()),{equals:(U,X)=>U.value===X.value}),void 0,(U)=>{return!Y&&G(U),U});return J&&$N(J((U=N())=>{Y=!0,W[1](Z(U)),Y=!1})),{signal:W,utils:K}}function WN(N){if(!N)return{signal:JN(KN({value:""}))};else if(Array.isArray(N))return{signal:N};return N}function sN(N){return{signal:[()=>N,(G)=>Object.assign(N,G)]}}function XN(){return UN(()=>({value:window.location.pathname+window.location.search+window.location.hash,state:history.state}),({value:N,replace:G,scroll:J,state:K})=>{if(G)window.history.replaceState(K,"",N);else window.history.pushState(K,"",N);ZN(window.location.hash.slice(1),J)},(N)=>YN(window,"popstate",()=>N()),{go:(N)=>window.history.go(N)})}function oN(){return UN(()=>window.location.hash.slice(1),({value:N,replace:G,scroll:J,state:K})=>{if(G)window.history.replaceState(K,"","#"+N);else window.location.hash=N;let Y=N.indexOf("#"),Z=Y>=0?N.slice(Y+1):"";ZN(Z,J)},(N)=>YN(window,"hashchange",()=>N()),{go:(N)=>window.history.go(N),renderPath:(N)=>`#${N}`,parsePath:(N)=>{let G=N.replace(/^.*?#/,"");if(!G.startsWith("/")){let[,J="/"]=window.location.hash.split("#",2);return`${J}#${G}`}return G}})}import{createContext as BN,useContext as c,useMemo as z,untrack as i,createElement as HN,useEffect as CN,useCleanup as jN,useResolved as PN}from"@solenopsys/converged-renderer";import QN from"@solenopsys/converged-reactive";var MN=100,u=BN(),y=BN(),E=()=>e(c(u),"Make sure your app is wrapped in a <Router />"),R,S=()=>R||c(y)||E().base,l=(N)=>{let G=S();return z(()=>G.resolvePath(N()))},n=(N)=>{let G=E();return z(()=>{let J=N();return J!==void 0?G.renderPath(J):J})},d=()=>E().navigatorFactory(),C=()=>E().location,DN=(N)=>{let G=C(),J=z(()=>m(N()));return z(()=>J()(G.pathname))},kN=()=>S().params,RN=()=>S().data,yN=()=>{let N=C(),G=d(),J=(K,Y)=>{let Z=i(()=>h(N.search,K));G(`${N.pathname}${Z}`,{scroll:!1,...Y})};return[N.query,J]};function FN(N){return Array.isArray(N)?N:[N]}function xN(N,G="",J){let{component:K,data:Y,children:Z}=N,W=!Z||Array.isArray(Z)&&!Z.length,U={key:N,element:K?()=>HN(K,{}):()=>{let{element:X}=N;return X===void 0&&J?HN(J,{}):X},preload:N.component?K.preload:N.preload,data:Y};return FN(N.path).reduce((X,Q)=>{for(let q of p(Q)){let H=g(G,q),L=W?H:H.split("/*",1)[0];X.push({...U,originalPath:q,pattern:L,matcher:m(L,!W)})}return X},[])}function gN(N,G=0){return{routes:N,score:GN(N[N.length-1])*1e4-G,matcher(J){let K=[];for(let Y=N.length-1;Y>=0;Y--){let Z=N[Y],W=Z.matcher(J);if(!W)return null;K.unshift({...W,route:Z})}return K}}}function s(N,G="",J,K=[],Y=[]){let Z=FN(PN(N,!0));for(let W=0,U=Z.length;W<U;W++){let X=Z[W];if(X&&typeof X==="object"&&Object.prototype.hasOwnProperty.call(X,"path")){let Q=xN(X,G,J);for(let q of Q){if(K.push(q),X.children)s(X.children,q.pattern,J,K,Y);else{let H=gN([...K],Y.length);Y.push(H)}K.pop()}}}return K.length?Y:Y.sort((W,U)=>U.score-W.score)}function LN(N,G){for(let J=0,K=N.length;J<K;J++){let Y=N[J].matcher(G);if(Y)return Y}return[]}var qN=new URL("http://sar");function bN(N,G){let J=z(()=>{let U=N();try{let X=new URL(U,origin);return qN=X,X}catch(X){return console.error(`Invalid path ${U}`),qN}},{equals:(U,X)=>U?.href===X?.href}),K=z(()=>O(J().pathname)),Y=z(()=>O(J().search,!0)),Z=z(()=>O(J().hash)),W=z(()=>"");return{get pathname(){return K()},get search(){return Y()},get hash(){return Z()},get state(){return Object.freeze(G())},get key(){return W()},query:v(b(Y,()=>NN(J())))}}function wN(N,G="",J,K){let{signal:[Y,Z],utils:W={}}=WN(N),U=W.parsePath||((B)=>B),X=W.renderPath||((B)=>B),Q=k("",G),q=K?Object.assign(K,{matches:[],url:void 0}):void 0;if(Q===void 0)throw new Error("Invalid base path");else if(Q&&!Y().value)Z({value:Q,replace:!0,scroll:!1});let H=QN(Y().value),L=QN(Y().state),w=bN(H,L),V=[],_={pattern:Q,params:{},path:()=>Q,outlet:()=>null,resolvePath(B){return k(Q,B)}};if(J)try{R=_,_.data=J({data:void 0,params:{},location:w,navigate:r(_)})}finally{R=void 0}function o(B,F,T){i(()=>{if(typeof F==="number"){if(!F);else if(W.go)W.go(F);else console.warn("Router integration does not support relative routing");return}let{replace:x,resolve:$,scroll:j,state:P}={replace:!1,resolve:!0,scroll:!0,...T},I=$?B.resolvePath(F):k("",F);if(I===void 0)throw new Error(`Path '${F}' is not a routable path`);else if(V.length>=MN)throw new Error("Too many redirects");let M=H();if(I!==M||P!==L()){let ON=V.push({value:M,replace:x,scroll:j,state:L()});if(H(I),L(P),V.length===ON)IN({value:I,state:P})}})}function r(B){return B=B||c(y)||_,(F,T)=>B&&o(B,F,T)}function IN(B){let F=V[0];if(F){if(B.value!==F.value||B.state!==F.state)Z({...B,replace:F.replace,scroll:F.scroll});V.length=0}}CN(()=>{let{value:B,state:F}=Y();i(()=>{if(B!==H())H(B),L(F)})});function a(B){if(B.defaultPrevented||B.button!==0||B.metaKey||B.altKey||B.ctrlKey||B.shiftKey)return;let F=B.composedPath().find((M)=>M instanceof Node&&M.nodeName.toUpperCase()==="A");if(!F||!F.hasAttribute("link"))return;let T=F.href;if(F.target||!T&&!F.hasAttribute("state"))return;let x=(F.getAttribute("rel")||"").split(/\s+/);if(F.hasAttribute("download")||x&&x.includes("external"))return;let $=new URL(T),j=O($.pathname);if($.origin!==window.location.origin||Q&&j&&!j.toLowerCase().startsWith(Q.toLowerCase()))return;let P=U(j+O($.search,!0)+O($.hash)),I=F.getAttribute("state");B.preventDefault(),o(_,P,{resolve:!1,replace:F.hasAttribute("replace"),scroll:!F.hasAttribute("noscroll"),state:I&&JSON.parse(I)})}return document.addEventListener("click",a),jN(()=>document.removeEventListener("click",a)),{base:_,out:q,location:w,renderPath:X,parsePath:U,navigatorFactory:r}}function zN(N,G,J,K){let{base:Y,location:Z,navigatorFactory:W}=N,{pattern:U,element:X,preload:Q,data:q}=K().route,H=z(()=>K().path),L=v(()=>K().params);Q?.();let w={parent:G,pattern:U,get child(){return J()},path:H,params:L,data:G.data,outlet:X,resolvePath(V){return k(Y.path(),V,H())}};if(q)try{R=w,w.data=q({data:G.data,params:L,location:Z,navigate:W(w)})}finally{R=void 0}return w}import{jsxDEV as A}from"@solenopsys/converged-renderer/jsx-dev-runtime";var XG=(N)=>{let{source:G,base:J,data:K,out:Y}=N,Z=G||XN(),W=wN(Z,J,K,Y);return console.log("INIT ROUTER CONTEXT"),A(u.Provider,{value:W,children:N.children},void 0,!1,void 0,this)},dN=(N)=>{let G=E(),J=S(),K=f(()=>s(N.children,g(J.pattern,N.base||""),fN)),Y=f(()=>LN(K(),G.location.pathname));if(G.out)G.out.matches.push(Y().map(({route:Q,path:q,params:H})=>({originalPath:Q.originalPath,pattern:Q.pattern,path:q,params:H})));let Z,W,U,X=f(b(Y,()=>{let Q=Y().length===W?.length,q=[];for(let H=0,L=Y().length;H<L;H++){let w=W?.[H],V=Y()[H];if(U&&w&&V.route.key===w.route.key)q[H]=U[H];else Q=!1,q[H]=zN(G,q[H-1]||J,()=>X()[H+1],()=>Y()[H])}if(U&&Q)return U;return Z=q[0],W=[...Y()],U=[...q],q}));return A(VN,{when:()=>X()&&Z,children:(Q)=>A(y.Provider,{value:Q(),children:()=>Q().outlet()},void 0,!1,void 0,this)},void 0,!1,void 0,this)},HG=(N,G)=>()=>A(dN,{base:G,children:N},void 0,!1,void 0,this),QG=(N)=>N,fN=()=>{let N=S();return A(VN,{when:()=>N.child,children:(G)=>A(y.Provider,{value:G(),children:()=>G().outlet()},void 0,!1,void 0,this)},void 0,!1,void 0,this)};function qG({activeClass:N="active",inactiveClass:G="inactive",children:J,class:K,end:Y,href:Z,state:W,...U}){let X=l(()=>Z),Q=C(),q=f(()=>{let H=X();if(H===void 0)return!1;let L=H.split(/[?#]/,1)[0].toLowerCase(),w=Q.pathname.toLowerCase();return Y?L===w:w.startsWith(L)});return A("a",{link:!0,...U,href:n(X)()??Z,state:JSON.stringify(W),class:()=>[{[G]:!q(),[N]:q()},K],"aria-current":()=>q()?"page":void 0,children:J},void 0,!1,void 0,this)}function BG(N){let G=d(),J=C(),{href:K,state:Y}=N,Z=typeof K==="function"?K({navigate:G,location:J}):K;return G(Z,{replace:!0,state:Y}),null}export{yN as useSearchParams,HG as useRoutes,RN as useRouteData,l as useResolvedPath,kN as useParams,d as useNavigate,DN as useMatch,C as useLocation,n as useHref,sN as staticIntegration,XN as pathIntegration,WN as normalizeIntegration,oN as hashIntegration,UN as createIntegration,h as _mergeSearchString,dN as Routes,XG as Router,QG as Route,fN as Outlet,BG as Navigate,qG as NavLink,qG as Link,qG as A};

//# debugId=307f0e4329c19cf9cb4c5b04f9dd7796b8bad0d99cd243a89621294567f91666
