var Fm=Symbol("Cached"),D=Symbol("Observable"),_m=Symbol("Observable.Boolean"),Im=Symbol("Observable.Frozen"),l=Symbol("Observable.Readable"),v=Symbol("Observable.Writable"),S=Symbol("Store"),qm=Symbol("Store.Keys"),jm=Symbol("Store.Observable"),Tm=Symbol("Store.Target"),Om=Symbol("Store.Values"),Xm=Symbol("Store.Untracked"),A=Symbol("Suspense"),Wm=Symbol("Uncached"),a=Symbol("Untracked"),$m=Symbol("Untracked.Unwrapped");var Wn=(m)=>{return h(m)?m:[m]},$n=(m)=>{if(m instanceof Error)return m;if(typeof m==="string")return new Error(m);return new Error("Unknown error")},{is:H}=Object,{isArray:h}=Array,Jn=(m,n)=>{if(m.length!==n.length)return!1;for(let o=0,f=m.length;o<f;o++){let i=m[o],t=n[o];if(!H(i,t))return!1}return!0},p=(m)=>{return typeof m==="function"},Jm=(m)=>{return m!==null&&typeof m==="object"},Zn=(m)=>{return typeof m==="symbol"},cm=()=>{return},zm=()=>{return!1};function Fo(){if(arguments.length)throw new Error("A readonly Observable can not be updated");else return this}function To(){if(arguments.length)throw new Error("A readonly Observable can not be updated");else return this.get()}function Oo(m){if(arguments.length)if(p(m))return this.update(m);else return this.set(m);else return this.get()}var Z=(m)=>{let n=Fo.bind(m);return n[D]=!0,n[Im]=!0,n},Q=(m)=>{let n=To.bind(m);return n[D]=!0,n[l]=m,n},Ym=(m)=>{let n=Oo.bind(m);return n[D]=!0,n[v]=m,n};var lm=0,Mm=1,e=2,mm=3,Dm=Z(!1),Qn=Z(!0),pm=new Proxy({},new Proxy({},{get(){throw new Error("Unavailable value")}})),hm=function(){};var ym=(m,n)=>{if(m instanceof Array)for(let o=0,f=m.length;o<f;o++)n(m[o]);else if(m)n(m)},Zm=(m,n)=>{if(m instanceof Array)for(let o=m.length-1;o>=0;o--)n(m[o]);else if(m)n(m)},X=(m,n,o)=>{let f=m[n];if(f instanceof Array)f.push(o);else if(f)m[n]=[f,o];else m[n]=o},P=(m,n,o)=>{let f=m[n];if(f instanceof Set)f.add(o);else if(f){if(o!==f){let i=new Set;i.add(f),i.add(o),m[n]=i}}else m[n]=o},C=(m,n,o)=>{let f=m[n];if(f instanceof Set)f.delete(o);else if(f===o)m[n]=void 0},nm=(m,n)=>{if(m instanceof Set)for(let o of m)n(o);else if(m)n(m)};var co=(m)=>m.call(m),vm=(m)=>m.dispose(!0);class Gn{parent;context;disposed=!1;cleanups=void 0;errorHandler=void 0;contexts=void 0;observers=void 0;roots=void 0;suspenses=void 0;catch(m,n){let{errorHandler:o}=this;if(o)return o(m),!0;else{if(this.parent?.catch(m,!0))return!0;if(n)return!1;throw m}}dispose(m){Zm(this.contexts,vm),Zm(this.observers,vm),Zm(this.suspenses,vm),Zm(this.cleanups,co),this.cleanups=void 0,this.disposed=m,this.errorHandler=void 0,this.observers=void 0,this.suspenses=void 0}get(m){return this.context?.[m]}wrap(m,n,o){let f=c,i=q;am(n),Rm(o);try{return m()}catch(t){return this.catch($n(t),!1),pm}finally{am(f),Rm(i)}}}var z=Gn;class xn extends z{context={}}var um=xn;var y,em=new um,q,c=em,mn=(m)=>y=m,Rm=(m)=>q=m,am=(m)=>c=m;var Em=0,Vn=cm,Mo=async(m)=>{if(!Em)mn(new Promise((n)=>Vn=n));try{return Em+=1,await m()}finally{if(Em-=1,!Em)mn(void 0),Vn()}},nn=Mo;var po=(m)=>{return p(m)&&_m in m},Nm=po;var Ro=(m)=>{return p(m)&&((Im in m)||!!m[l]?.parent?.disposed)},u=Ro;var wo=(m)=>{return p(m)&&((a in m)||($m in m))},wm=wo;class Kn{waiting=[];counter=0;locked=!1;flush=()=>{if(this.locked)return;if(this.counter)return;if(!this.waiting.length)return;try{this.locked=!0;while(!0){let m=this.waiting;if(!m.length)break;this.waiting=[];for(let n=0,o=m.length;n<o;n++)m[n].update()}}finally{this.locked=!1}};wrap=(m)=>{this.counter+=1,m(),this.counter-=1,this.flush()};schedule=(m)=>{this.waiting.push(m)}}var om=new Kn;class An{parent;value;equals;observers=new Set;constructor(m,n,o){if(this.value=m,o)this.parent=o;if(n?.equals!==void 0)this.equals=n.equals||zm}get(){if(!this.parent?.disposed)this.parent?.update(),q?.observables.link(this);return this.value}set(m){let n=this.equals||H;if(!(this.value===hm||!n(m,this.value)))return m;return this.value=m,om.counter+=1,this.stale(mm),om.counter-=1,om.flush(),m}stale(m){for(let n of this.observers)if(n.status!==Mm||n.observables.has(this))if(n.sync)n.status=Math.max(n.status,m),om.schedule(n);else n.stale(m)}update(m){let n=m(this.value);return this.set(n)}}var U=An;class on{observer;observables;observablesIndex;constructor(m){this.observer=m,this.observables=[],this.observablesIndex=0}dispose(m){if(m){let{observer:n,observables:o}=this;for(let f=0;f<o.length;f++)o[f].observers.delete(n)}this.observablesIndex=0}postdispose(){let{observer:m,observables:n,observablesIndex:o}=this,f=n.length;if(o<f){for(let i=o;i<f;i++)n[i].observers.delete(m);n.length=o}}empty(){return!this.observables.length}has(m){let n=this.observables.indexOf(m);return n>=0&&n<this.observablesIndex}link(m){let{observer:n,observables:o,observablesIndex:f}=this,i=o.length;if(i>0){if(o[f]===m){this.observablesIndex+=1;return}let t=o.indexOf(m);if(t>=0&&t<f)return;if(f<i-1)this.postdispose();else if(f===i-1)o[f].observers.delete(n)}if(m.observers.add(n),o[this.observablesIndex++]=m,f===128)n.observables=new Pn(n,o)}update(){let{observables:m}=this;for(let n=0,o=m.length;n<o;n++)m[n].parent?.update()}}class Pn{observer;observables;constructor(m,n){this.observer=m,this.observables=new Set(n)}dispose(m){for(let n of this.observables)n.observers.delete(this.observer)}postdispose(){return}empty(){return!this.observables.size}has(m){return this.observables.has(m)}link(m){let{observer:n,observables:o}=this,f=o.size;m.observers.add(n);let i=o.size;if(f===i)return;o.add(m)}update(){for(let m of this.observables)m.parent?.update()}}class Cn extends z{parent=c;context=c.context;status=mm;observables;sync;constructor(){super();if(this.observables=new on(this),c!==em)X(this.parent,"observers",this)}dispose(m){this.observables.dispose(m),super.dispose(m)}refresh(m){this.dispose(!1),this.status=Mm;try{return this.wrap(m,this,this)}finally{this.observables.postdispose()}}run(){throw new Error("Abstract method")}stale(m){throw new Error("Abstract method")}update(){if(this.disposed)return;if(this.status===e)this.observables.update();if(this.status===mm)if(this.status=Mm,this.run(),this.status===Mm)this.status=lm;else this.update();else this.status=lm}}var bm=Cn;class Ln extends bm{fn;observable;declaresync;constructor(m,n){super();if(this.fn=m,this.observable=new U(hm,n,this),n?.sync===!0)this.sync=!0,this.update()}run(){let m=super.refresh(this.fn);if(!this.disposed&&this.observables.empty())this.disposed=!0;if(m!==pm)this.observable.set(m)}stale(m){let n=this.status;if(n>=m)return;if(this.status=m,n===e)return;this.observable.stale(e)}}var Hn=Ln;var bo=(m,n)=>{if(u(m))return m;else if(wm(m))return Z(m());else{let o=new Hn(m,n);return Q(o.observable)}},_=bo;var Bo=(m)=>{if(p(m))if(u(m)||wm(m))return!!m();else if(Nm(m))return m;else{let n=_(()=>!!m());return n[_m]=!0,n}else return!!m},fm=Bo;var ro=(m)=>{X(c,"cleanups",m)},G=ro;class qn extends z{parent=c;context;constructor(m){super();this.context={...c.context,...m},X(this.parent,"contexts",this)}wrap(m){return super.wrap(m,this,void 0)}}var jn=qn;var Uo=(m,n)=>{if(Zn(m))return c.context[m];else return new jn(m).wrap(n||cm)},fn=Uo;var _o=()=>{let m=new U(!1);return G(()=>m.set(!0)),Q(m)},tn=_o;class Xn{waiting=[];locked=!1;queued=!1;flush=()=>{if(this.locked)return;if(!this.waiting.length)return;try{this.locked=!0;while(!0){let m=this.waiting;if(!m.length)break;this.waiting=[];for(let n=0,o=m.length;n<o;n++)m[n].update()}}finally{this.locked=!1}};queue=()=>{if(this.queued)return;this.queued=!0,this.resolve()};resolve=()=>{queueMicrotask(()=>{queueMicrotask(()=>{if(y)y.finally(this.resolve);else this.queued=!1,this.flush()})})};schedule=(m)=>{this.waiting.push(m),this.queue()}}var im=new Xn;class zn extends bm{fn;suspense;init;constructor(m,n){super();if(this.fn=m,n?.suspense!==!1){let o=this.get(A);if(o)this.suspense=o}if(n?.sync===!0)this.sync=!0;if(n?.sync==="init")this.init=!0,this.update();else this.schedule()}run(){let m=super.refresh(this.fn);if(p(m))X(this,"cleanups",m)}schedule(){if(this.suspense?.suspended)return;if(this.sync)this.update();else im.schedule(this)}stale(m){let n=this.status;if(n>=m)return;if(this.status=m,!this.sync||n!==2&&n!==3)this.schedule()}update(){if(this.suspense?.suspended)return;super.update()}}var km=zn;var Io=(m,n)=>{let o=new km(m,n);return()=>o.dispose(!0)},E=Io;var Qm=(m)=>{if(p(m))if($m in m)return Qm(m());else if(a in m)return Z(Qm(m()));else if(D in m)return m;else return _(()=>Qm(m()));if(m instanceof Array){let n=new Array(m.length);for(let o=0,f=n.length;o<f;o++)n[o]=Qm(m[o]);return n}else return m},Wo=Qm,I=Wo;class Yn extends z{parent=c;context=c.context;registered;constructor(m){super();if(m){if(this.get(A))this.registered=!0,P(this.parent,"roots",this)}}dispose(m){if(this.registered)C(this.parent,"roots",this);super.dispose(m)}wrap(m){let n=()=>this.dispose(!0),o=()=>m(n);return super.wrap(o,this,void 0)}}var g=Yn;var $o=Z(-1);class Dn extends g{bool;index;result}class hn{parent=c;suspense=c.get(A);fn;fnWithIndex;cache=new Map;bool=!1;prevCount=0;reuseCount=0;nextCount=0;constructor(m){if(this.fn=m,this.fnWithIndex=m.length>1,this.suspense)P(this.parent,"roots",this.roots)}cleanup=()=>{if(!this.prevCount)return;if(this.prevCount===this.reuseCount)return;let{cache:m,bool:n}=this;if(!m.size)return;if(this.nextCount)m.forEach((o,f)=>{if(o.bool===n)return;o.dispose(!0),m.delete(f)});else this.cache.forEach((o)=>{o.dispose(!0)}),this.cache=new Map};dispose=()=>{if(this.suspense)C(this.parent,"roots",this.roots);this.prevCount=this.cache.size,this.reuseCount=0,this.nextCount=0,this.cleanup()};before=()=>{this.bool=!this.bool,this.reuseCount=0,this.nextCount=0};after=(m)=>{this.nextCount=m.length,this.cleanup(),this.prevCount=this.nextCount,this.reuseCount=0};map=(m)=>{this.before();let{cache:n,bool:o,fn:f,fnWithIndex:i}=this,t=new Array(m.length),O=!0,T=!0,F=0;for(let M=0,$=m.length;M<$;M++){let B=m[M],w=n.get(B);if(w&&w.bool!==o)T=!1,F+=1,w.bool=o,w.index?.set(M),t[M]=w.result;else{O=!1;let b=new Dn(!1);if(w)G(()=>b.dispose(!0));b.wrap(()=>{let r=$o;if(i)b.index=new U(M),r=Q(b.index);let k=t[M]=I(f(B,r));if(b.bool=o,b.result=k,!w)n.set(B,b)})}}if(this.reuseCount=F,this.after(m),O)t[Fm]=!0;if(T)t[Wm]=!0;return t};roots=()=>{return Array.from(this.cache.values())}}var yn=hn;var Jo=(m)=>{return p(m)&&D in m},tm=Jo;var Zo=(m,n=!0)=>{if((n?p:tm)(m))return m();else return m},L=Zo;class un extends z{parent=c;context={...c.context,[A]:this};observable;suspended;constructor(){super();X(this.parent,"suspenses",this),this.suspended=c.get(A)?.suspended||0}toggle(m){if(!this.suspended&&!m)return;let n=this.suspended,o=n+(m?1:-1);if(this.suspended=o,!!n===!!o)return;this.observable?.set(!!o);let f=(T)=>{ym(T.contexts,f),ym(T.observers,i),ym(T.suspenses,O),nm(T.roots,t)},i=(T)=>{if(T instanceof km){if(T.status===e||T.status===mm)if(T.init)T.update();else T.schedule()}f(T)},t=(T)=>{if(p(T))T().forEach(f);else f(T)},O=(T)=>{T.toggle(m)};f(this)}wrap(m){return super.wrap(m,this,void 0)}}var Sm=un;var Qo=(m,n)=>{let o=new Sm,f=fm(m);return E(()=>o.toggle(L(f)),{sync:!0}),o.wrap(n)},Gm=Qo;var Go=Z(-1);class En extends g{index;value;suspended;result}class Nn{parent=c;suspense=c.get(A);fn;fnWithIndex;cache=new Map;pool=[];poolMaxSize=0;pooled;constructor(m,n){if(this.fn=m,this.fnWithIndex=m.length>1,this.pooled=n,this.suspense)P(this.parent,"roots",this.roots)}cleanup=()=>{let m=0,n=Math.max(0,this.pooled?this.poolMaxSize-this.pool.length:0);this.cache.forEach((o)=>{if(n>0&&m++<n)o.suspended?.set(!0),this.pool.push(o);else o.dispose(!0)})};dispose=()=>{if(this.suspense)C(this.parent,"roots",this.roots);this.cache.forEach((m)=>{m.dispose(!0)}),this.pool.forEach((m)=>{m.dispose(!0)})};map=(m)=>{let{cache:n,fn:o,fnWithIndex:f}=this,i=new Map,t=new Array(m.length),O=this.pool,T=this.pooled,F=!0,M=!0,$=[];if(n.size)for(let B=0,w=m.length;B<w;B++){let b=m[B],r=n.get(b);if(r)M=!1,n.delete(b),i.set(b,r),r.index?.set(B),t[B]=r.result;else $.push(B)}else $=new Array(t.length);m:for(let B=0,w=$.length;B<w;B++){let b=$[B]||B,r=m[b],k=i.has(r);if(!k)for(let[Um,s]of n.entries()){n.delete(Um),i.set(r,s),s.index?.set(b),s.value?.set(r),t[b]=s.result;continue m}F=!1;let J;if(T&&O.length)J=O.pop(),J.index?.set(b),J.value?.set(r),J.suspended?.set(!1),t[b]=J.result;else J=new En(!1),J.wrap(()=>{let Um=Go;if(f)J.index=new U(b),Um=Q(J.index);let s=J.value=new U(r),sm=T?new U(!1):void 0,In=_(()=>L(s.get())),to=t[b]=sm?Gm(()=>sm.get(),()=>I(o(In,Um))):I(o(In,Um));J.value=s,J.result=to,J.suspended=sm});if(k)G(()=>J.dispose(!0));else i.set(r,J)}if(this.poolMaxSize=Math.max(this.poolMaxSize,t.length),this.cleanup(),this.cache=i,F)t[Fm]=!0;if(M)t[Wm]=!0;return t};roots=()=>{return[...this.cache.values(),...this.pool.values()]}}var kn=Nn;var xo=(m)=>{return Jm(m)&&S in m},V=xo;var Vo=(m)=>{if(p(m)){let n=q;if(n)try{return Rm(void 0),m()}finally{Rm(n)}else return m()}else return m},Ko=Vo,x=Ko;function Ao(m,n,o=[],f){if(h(m)&&!V(m)){let i=!!f?.unkeyed;return Z(x(()=>{if(m.length)return m.map((t,O)=>{return I(n(i&&!tm(t)?Z(t):t,O))});else return I(o)}))}else{let{dispose:i,map:t}=f?.unkeyed?new kn(n,!!f.pooled):new yn(n);G(i);let O=_(()=>{return L(m)??[]},{equals:(T,F)=>{return!!T&&!!F&&!T.length&&!F.length&&!V(T)&&!V(F)}});return _(()=>{let T=O();if(V(T))T[Om];return x(()=>{let F=t(T);return F?.length?F:I(o)})},{equals:(T,F)=>{return h(T)&&!!T[Fm]&&h(F)&&Jn(T,F)}})}}var Fn=Ao;var Po=(m)=>{return x(m),m},gm=Po;var Tn=(m,n,o)=>{for(let f=0,i=n.length;f<i;f++){let t=n[f];if(t.length===1)return t[0];if(H(t[0],m))return t[1]}return o};function Co(m,n,o){if(p(m)&&!u(m)&&!wm(m)){if(Nm(m))return _(()=>I(Tn(m(),n,o)));let i=gm(_(()=>Tn(m(),n,o)));if(u(i))return Z(I(i()));else return _(()=>I(L(i)))}else{let i=Tn(L(m),n,o);return Z(I(i))}}var xm=Co;var Lo=(m,n,o)=>{let f=fm(m);return xm(f,[[!0,n],[o]])},Vm=Lo;function Ho(m,n,o){return Vm(m,n,o)}var On=Ho;var qo=()=>{return!!y||im.queued||im.locked||om.locked},Km=qo;var jo=(m,n)=>{return Ym(new U(m,n))},Am=jo;var Xo=()=>{let m=c instanceof um,n=c instanceof g,o=c instanceof Sm,f=c instanceof bm;return{isSuperRoot:m,isRoot:n,isSuspense:o,isComputation:f}},cn=Xo;var zo=(m)=>{return p(m)&&v in m},Sn=zo;var Yo=(m)=>{if(p(m))return m[l]||m[v]||pm;else return m},gn=Yo;var Do=(m)=>{if(Sn(m))return Q(gn(m));else return m},Mn=Do;var ho=(m)=>{return new g(!0).wrap(m)},pn=ho;class dn extends Map{disposed=!1}class sn extends U{count=1;selecteds;source;call(){if(this.selecteds.disposed)return;if(this.count-=1,this.count)return;this.selecteds.delete(this.source)}}var yo=(m)=>{if(m=gm(_(m)),u(m)){let i=x(m);return(t)=>{return t===i?Qn:Dm}}let n=new dn,o=x(m);return E(()=>{let i=o,t=m();if(H(i,t))return;o=t,n.get(i)?.set(!1),n.get(t)?.set(!0)},{suspense:!1,sync:!0}),G(()=>{n.disposed=!0}),(i)=>{let t=n.get(i);if(t)t.count+=1;else t=new sn(i===o),t.selecteds=n,t.source=i,n.set(i,t);return G(t),Q(t)}},Rn=yo;class N extends Map{insert(m,n){return super.set(m,n),n}}class Hm{count=0;listen(){this.count+=1,G(this)}call(){if(this.count-=1,this.count)return;this.dispose()}dispose(){}}class an extends Hm{parent;observable;constructor(m,n){super();this.parent=m;this.observable=n}dispose(){this.parent.keys=void 0}}class en extends Hm{parent;observable;constructor(m,n){super();this.parent=m;this.observable=n}dispose(){this.parent.values=void 0}}class mo extends Hm{parent;key;observable;constructor(m,n,o){super();this.parent=m;this.key=n;this.observable=o}dispose(){this.parent.has?.delete(this.key)}}class no extends Hm{parent;key;observable;node;constructor(m,n,o,f){super();this.parent=m;this.key=n;this.observable=o;this.node=f}dispose(){this.parent.properties?.delete(this.key)}}var K={active:0,listeners:new Set,nodes:new Set,prepare:()=>{let{listeners:m,nodes:n}=K,o=new Set,f=(i)=>{if(o.has(i))return;o.add(i),nm(i.parents,f),nm(i.listenersRegular,(t)=>{m.add(t)})};return n.forEach(f),()=>{m.forEach((i)=>{i()})}},register:(m)=>{K.nodes.add(m),j.schedule()},reset:()=>{K.listeners=new Set,K.nodes=new Set}},W={active:0,nodes:new Map,prepare:()=>{let{nodes:m}=W;return()=>{m.forEach((n,o)=>{let f=Array.from(n);nm(o.listenersRoots,(i)=>{i(f)})})}},register:(m,n)=>{let o=W.nodes.get(m)||new Set;o.add(n),W.nodes.set(m,o),j.schedule()},registerWith:(m,n,o)=>{if(!n.parents){let f=m?.store||x(()=>n.store[o]);W.register(n,f)}else{let f=new Set,i=(t)=>{if(f.has(t))return;f.add(t),nm(t.parents,(O)=>{if(!O.parents)W.register(O,t.store);i(O)})};i(m||n)}},reset:()=>{W.nodes=new Map}},j={active:!1,flush:()=>{let m=K.prepare(),n=W.prepare();j.reset(),m(),n()},flushIfNotBatching:()=>{if(Km())if(y)y.finally(j.flushIfNotBatching);else setTimeout(j.flushIfNotBatching,0);else j.flush()},reset:()=>{j.active=!1,K.reset(),W.reset()},schedule:()=>{if(j.active)return;j.active=!0,queueMicrotask(j.flushIfNotBatching)}},Bm=new WeakMap,uo=new Set([S,qm,jm,Tm,Om]),Eo=new Set(["__proto__","__defineGetter__","__defineSetter__","__lookupGetter__","__lookupSetter__","prototype","constructor","hasOwnProperty","isPrototypeOf","propertyIsEnumerable","toLocaleString","toSource","toString","valueOf"]),No={get:(m,n)=>{if(uo.has(n)){if(n===S)return!0;if(n===Tm)return m;if(n===qm){if(Pm()){let F=Y(m);F.keys||=ln(F),F.keys.listen(),F.keys.observable.get()}return}if(n===Om){if(Pm()){let F=Y(m);F.values||=So(F),F.values.listen(),F.values.observable.get()}return}if(n===jm)return(F)=>{F=typeof F==="number"?String(F):F;let M=Y(m),$=M.getters?.get(F);if($)return $.bind(M.store);M.properties||=new N;let B=m[F],w=M.properties.get(F)||M.properties.insert(F,vn(M,F,B)),b=M.equals?{equals:M.equals}:void 0;return w.observable||=Lm(M,B,b),Q(w.observable)}}if(Eo.has(n))return m[n];let o=Y(m),f=o.getters?.get(n),i=f||m[n];o.properties||=new N;let t=Pm(),O=Cm(i),T=t||O?o.properties.get(n)||o.properties.insert(n,vn(o,n,i)):void 0;if(T?.node)P(T.node,"parents",o);if(T&&t){let F=o.equals?{equals:o.equals}:void 0;T.listen(),T.observable||=Lm(o,i,F),T.observable.get()}if(f)return f.call(o.store);else{if(typeof i==="function"&&i===Array.prototype[n])return function(){return i.apply(o.store,arguments)};return T?.node?.store||i}},set:(m,n,o)=>{o=d(o);let f=Y(m),i=f.setters?.get(n);if(i)i.call(f.store,o);else{let t=m[n],O=!!t||n in m,T=f.equals||H;if(O&&T(o,t)&&(n!=="length"||!Array.isArray(m)))return!0;if(m[n]=o,f.values?.observable.set(0),!O)f.keys?.observable.set(0),f.has?.get(n)?.observable.set(!0);let F=f.properties?.get(n);if(F?.node)C(F.node,"parents",f);if(F)F.observable?.set(o),F.node=Cm(o)?Bm.get(o)||dm(o,f):void 0;if(F?.node)P(F.node,"parents",f);if(W.active)W.registerWith(F?.node,f,n);if(K.active)K.register(f)}return!0},deleteProperty:(m,n)=>{if(!(n in m))return!0;if(!Reflect.deleteProperty(m,n))return!1;let i=Y(m);i.keys?.observable.set(0),i.values?.observable.set(0),i.has?.get(n)?.observable.set(!1);let t=i.properties?.get(n);if(W.active)W.registerWith(t?.node,i,n);if(t?.node)C(t.node,"parents",i);if(t)t.observable?.set(void 0),t.node=void 0;if(K.active)K.register(i);return!0},defineProperty:(m,n,o)=>{let f=Y(m),i=f.equals||H,t=n in m,O=Reflect.getOwnPropertyDescriptor(m,n);if("value"in o&&V(o.value))o={...o,value:d(o.value)};if(O&&ao(O,o,i))return!0;if(!Reflect.defineProperty(m,n,o))return!1;if(!o.get)f.getters?.delete(n);else if(o.get)f.getters||=new N,f.getters.set(n,o.get);if(!o.set)f.setters?.delete(n);else if(o.set)f.setters||=new N,f.setters.set(n,o.set);if(t!==!!o.enumerable)f.keys?.observable.set(0);f.has?.get(n)?.observable.set(!0);let F=f.properties?.get(n);if(W.active)W.registerWith(F?.node,f,n);if(F?.node)C(F.node,"parents",f);if(F)if("get"in o)F.observable?.set(o.get),F.node=void 0;else{let M=o.value;F.observable?.set(M),F.node=Cm(M)?Bm.get(M)||dm(M,f):void 0}if(F?.node)P(F.node,"parents",f);if(W.active)W.registerWith(F?.node,f,n);if(K.active)K.register(f);return!0},has:(m,n)=>{if(n===S)return!0;if(n===Tm)return!0;let o=n in m;if(Pm()){let f=Y(m);f.has||=new N;let i=f.has.get(n)||f.has.insert(n,go(f,n,o));i.listen(),i.observable.get()}return o},ownKeys:(m)=>{let n=Reflect.ownKeys(m);if(Pm()){let o=Y(m);o.keys||=ln(o),o.keys.listen(),o.keys.observable.get()}return n}},ko={has:(m,n)=>{if(n===Xm)return!0;return n in m}},dm=(m,n,o)=>{let f=new Proxy(m,No),i=so(m),t={parents:n,store:f};if(i){let{getters:O,setters:T}=i;if(O)t.getters=O;if(T)t.setters=T}if(o===!1)t.equals=zm;else if(o)t.equals=o;else if(n?.equals)t.equals=n.equals;return Bm.set(m,t),t},Y=(m)=>{let n=Bm.get(m);if(!n)throw new Error("Impossible");return n},oo=(m)=>{return Y(d(m))},ln=(m)=>{let n=Lm(m,0,{equals:!1});return new an(m,n)},So=(m)=>{let n=Lm(m,0,{equals:!1});return new en(m,n)},go=(m,n,o)=>{let f=Lm(m,o);return new mo(m,n,f)},Lm=(m,n,o)=>{return new U(n,o)},vn=(m,n,o)=>{let i=Cm(o)?Bm.get(o)||dm(o,m):void 0,t=new no(m,n,void 0,i);return m.properties||=new N,m.properties.set(n,t),t},so=(m)=>{if(h(m))return;let n,o,f=Object.keys(m);for(let i=0,t=f.length;i<t;i++){let O=f[i],T=Object.getOwnPropertyDescriptor(m,O);if(!T)continue;let{get:F,set:M}=T;if(F)n||=new N,n.set(O,F);if(M)o||=new N,o.set(O,M)}if(!n&&!o)return;return{getters:n,setters:o}},lo=(m,n)=>{if(V(m))return m;return(Bm.get(m)||dm(m,void 0,n?.equals)).store},d=(m)=>{if(V(m))return m[Tm];return m},vo=(m)=>{if(!Jm(m))return m;if(fo(m))return m;return new Proxy(m,ko)},ao=(m,n,o)=>{return!!m.configurable===!!n.configurable&&!!m.enumerable===!!n.enumerable&&!!m.writable===!!n.writable&&o(m.value,n.value)&&m.get===n.get&&m.set===n.set},Pm=()=>{return!!q},Cm=(m)=>{if(m===null||typeof m!=="object")return!1;if(S in m)return!0;if(Xm in m)return!1;if(h(m))return!0;let n=Object.getPrototypeOf(m);if(n===null)return!0;return Object.getPrototypeOf(n)===null},fo=(m)=>{if(m===null||typeof m!=="object")return!1;return Xm in m},rm=(m,n)=>{if(!Jm(m))return m;if(fo(m))return m;return lo(m,n)};rm.on=(m,n)=>{let o=V(m)?[m]:Wn(m),f=o.filter(p),i=o.filter(V).map(oo);K.active+=1;let t=f.map((O)=>{let T=!1;return E(()=>{if(T)K.listeners.add(n),j.schedule();T=!0,O()},{suspense:!1,sync:!0})});return i.forEach((O)=>{P(O,"listenersRegular",n)}),()=>{K.active-=1,t.forEach((O)=>{O()}),i.forEach((O)=>{C(O,"listenersRegular",n)})}};rm._onRoots=(m,n)=>{if(!V(m))return cm;let o=oo(m);if(o.parents)throw new Error("Only top-level stores are supported");return W.active+=1,P(o,"listenersRoots",n),()=>{W.active-=1,C(o,"listenersRoots",n)}};rm.reconcile=(()=>{let m=(i)=>{if(h(i))return 1;if(Cm(i))return 2;return 0},n=(i,t)=>{let O=d(i),T=d(t);o(i,t);let F=m(O),M=m(T);if(F===1||M===1)i.length=t.length;return i},o=(i,t)=>{let O=d(i),T=d(t),F=Object.keys(O),M=Object.keys(T);for(let $=0,B=M.length;$<B;$++){let w=M[$],b=O[w],r=T[w];if(!H(b,r)){let k=m(b),J=m(r);if(k&&k===J){if(o(i[w],r),k===1)i[w].length=r.length}else i[w]=r}else if(b===void 0&&!(w in O))i[w]=void 0}for(let $=0,B=F.length;$<B;$++){let w=F[$];if(!(w in T))delete i[w]}return i};return(i,t)=>{return x(()=>{return n(i,t)})}})();rm.untrack=(m)=>{return vo(m)};rm.unwrap=(m)=>{return d(m)};var wn=rm;var eo=()=>{let m=c.get(A);if(!m)return Dm;let n=m.observable||=new U(!!m.suspended);return Q(n)},bn=eo;var mf=()=>{im.flush()},Bn=mf;var nf=(m,n)=>{let o=Am();return _(()=>{let f=o();if(f)return I(n({error:f,reset:()=>o(void 0)}));else return c.errorHandler=o,I(m)})},rn=nf;var of=(m)=>{let n=p(m)?(...o)=>x(()=>m(...o)):()=>m;return n[a]=!0,n},Un=of;var ff=()=>{let m=c,n=q;return(o)=>{return m.wrap(()=>o(),m,n)}},_n=ff;function R(m,n){return Ym(new U(m,n))}R.batch=nn;R.boolean=fm;R.cleanup=G;R.context=fn;R.disposed=tn;R.effect=E;R.for=Fn;R.get=L;R.if=On;R.isBatching=Km;R.isObservable=tm;R.isStore=V;R.memo=_;R.observable=Am;R.owner=cn;R.readonly=Mn;R.resolve=I;R.root=pn;R.selector=Rn;R.store=wn;R.suspended=bn;R.suspense=Gm;R.switch=xm;R.ternary=Vm;R.tick=Bn;R.tryCatch=rn;R.untrack=x;R.untracked=Un;R.with=_n;var io=R;var zO=io;export{_n as with,Un as untracked,x as untrack,rn as tryCatch,Bn as tick,Vm as ternary,xm as switch,Gm as suspense,bn as suspended,wn as store,Rn as selector,pn as root,I as resolve,Mn as readonly,cn as owner,Am as observable,_ as memo,V as isStore,tm as isObservable,Km as isBatching,On as if,L as get,Fn as for,E as effect,tn as disposed,zO as default,fn as context,G as cleanup,fm as boolean,nn as batch,$m as SYMBOL_UNTRACKED_UNWRAPPED,a as SYMBOL_UNTRACKED,Wm as SYMBOL_UNCACHED,Om as SYMBOL_STORE_VALUES,Tm as SYMBOL_STORE_TARGET,jm as SYMBOL_STORE_OBSERVABLE,qm as SYMBOL_STORE_KEYS,S as SYMBOL_STORE,v as SYMBOL_OBSERVABLE_WRITABLE,l as SYMBOL_OBSERVABLE_READABLE,Im as SYMBOL_OBSERVABLE_FROZEN,_m as SYMBOL_OBSERVABLE_BOOLEAN,D as SYMBOL_OBSERVABLE};

//# debugId=e81affefe99b3dfd1afe28033039b5cb2aed09bbec6206f040f9d46e921abcb1
