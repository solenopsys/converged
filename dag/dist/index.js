import{createRequire as D6}from"node:module";var L6=Object.create;var{getPrototypeOf:V6,defineProperty:u2,getOwnPropertyNames:B6}=Object;var S6=Object.prototype.hasOwnProperty;var p2=(b,w,$)=>{$=b!=null?L6(V6(b)):{};let U=w||!b||!b.__esModule?u2($,"default",{value:b,enumerable:!0}):$;for(let J of B6(b))if(!S6.call(U,J))u2(U,J,{get:()=>b[J],enumerable:!0});return U};var M=(b,w)=>()=>(w||b((w={exports:{}}).exports,w),w.exports);var K6=(b,w)=>{for(var $ in w)u2(b,$,{get:w[$],enumerable:!0,configurable:!0,set:(U)=>w[$]=()=>U})};var S=D6(import.meta.url);var H5=M((Rw)=>{Rw.parse=function(b,w){return new Y5(b,w).parse()};class Y5{constructor(b,w){this.source=b,this.transform=w||zw,this.position=0,this.entries=[],this.recorded=[],this.dimension=0}isEof(){return this.position>=this.source.length}nextCharacter(){var b=this.source[this.position++];if(b==="\\")return{value:this.source[this.position++],escaped:!0};return{value:b,escaped:!1}}record(b){this.recorded.push(b)}newEntry(b){var w;if(this.recorded.length>0||b){if(w=this.recorded.join(""),w==="NULL"&&!b)w=null;if(w!==null)w=this.transform(w);this.entries.push(w),this.recorded=[]}}consumeDimensions(){if(this.source[0]==="[")while(!this.isEof()){var b=this.nextCharacter();if(b.value==="=")break}}parse(b){var w,$,U;this.consumeDimensions();while(!this.isEof())if(w=this.nextCharacter(),w.value==="{"&&!U){if(this.dimension++,this.dimension>1)$=new Y5(this.source.substr(this.position-1),this.transform),this.entries.push($.parse(!0)),this.position+=$.position-2}else if(w.value==="}"&&!U){if(this.dimension--,!this.dimension){if(this.newEntry(),b)return this.entries}}else if(w.value==='"'&&!w.escaped){if(U)this.newEntry(!0);U=!U}else if(w.value===","&&!U)this.newEntry();else this.record(w.value);if(this.dimension!==0)throw new Error("array dimension not balanced");return this.entries}}function zw(b){return b}});var j5=M((TY,Lb)=>{var Nw=H5();Lb.exports={create:function(b,w){return{parse:function(){return Nw.parse(b,w)}}}}});var Sb=M((vY,Bb)=>{var Aw=/(\d{1,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,})?.*?( BC)?$/,cw=/^(\d{1,})-(\d{2})-(\d{2})( BC)?$/,Lw=/([Z+-])(\d{2})?:?(\d{2})?:?(\d{2})?/,Vw=/^-?infinity$/;Bb.exports=function b(w){if(Vw.test(w))return Number(w.replace("i","I"));var $=Aw.exec(w);if(!$)return Bw(w)||null;var U=!!$[8],J=parseInt($[1],10);if(U)J=Vb(J);var W=parseInt($[2],10)-1,_=$[3],X=parseInt($[4],10),G=parseInt($[5],10),Q=parseInt($[6],10),H=$[7];H=H?1000*parseFloat(H):0;var z,N=Sw(w);if(N!=null){if(z=new Date(Date.UTC(J,W,_,X,G,Q,H)),q5(J))z.setUTCFullYear(J);if(N!==0)z.setTime(z.getTime()-N)}else if(z=new Date(J,W,_,X,G,Q,H),q5(J))z.setFullYear(J);return z};function Bw(b){var w=cw.exec(b);if(!w)return;var $=parseInt(w[1],10),U=!!w[4];if(U)$=Vb($);var J=parseInt(w[2],10)-1,W=w[3],_=new Date($,J,W);if(q5($))_.setFullYear($);return _}function Sw(b){if(b.endsWith("+00"))return 0;var w=Lw.exec(b.split(" ")[1]);if(!w)return;var $=w[1];if($==="Z")return 0;var U=$==="-"?-1:1,J=parseInt(w[2],10)*3600+parseInt(w[3]||0,10)*60+parseInt(w[4]||0,10);return J*U*1000}function Vb(b){return-(b-1)}function q5(b){return b>=0&&b<100}});var Db=M((lY,Kb)=>{Kb.exports=Dw;var Kw=Object.prototype.hasOwnProperty;function Dw(b){for(var w=1;w<arguments.length;w++){var $=arguments[w];for(var U in $)if(Kw.call($,U))b[U]=$[U]}return b}});var Eb=M((hY,Fb)=>{var Ow=Db();Fb.exports=j1;function j1(b){if(!(this instanceof j1))return new j1(b);Ow(this,fw(b))}var Fw=["seconds","minutes","hours","days","months","years"];j1.prototype.toPostgres=function(){var b=Fw.filter(this.hasOwnProperty,this);if(this.milliseconds&&b.indexOf("seconds")<0)b.push("seconds");if(b.length===0)return"0";return b.map(function(w){var $=this[w]||0;if(w==="seconds"&&this.milliseconds)$=($+this.milliseconds/1000).toFixed(6).replace(/\.?0+$/,"");return $+" "+w},this).join(" ")};var Ew={years:"Y",months:"M",days:"D",hours:"H",minutes:"M",seconds:"S"},Cw=["years","months","days"],kw=["hours","minutes","seconds"];j1.prototype.toISOString=j1.prototype.toISO=function(){var b=Cw.map($,this).join(""),w=kw.map($,this).join("");return"P"+b+"T"+w;function $(U){var J=this[U]||0;if(U==="seconds"&&this.milliseconds)J=(J+this.milliseconds/1000).toFixed(6).replace(/0+$/,"");return J+Ew[U]}};var z5="([+-]?\\d+)",Pw=z5+"\\s+years?",Iw=z5+"\\s+mons?",Tw=z5+"\\s+days?",vw="([+-])?([\\d]*):(\\d\\d):(\\d\\d)\\.?(\\d{1,6})?",lw=new RegExp([Pw,Iw,Tw,vw].map(function(b){return"("+b+")?"}).join("\\s*")),Ob={years:2,months:4,days:6,hours:9,minutes:10,seconds:11,milliseconds:12},hw=["hours","minutes","seconds","milliseconds"];function xw(b){var w=b+"000000".slice(b.length);return parseInt(w,10)/1000}function fw(b){if(!b)return{};var w=lw.exec(b),$=w[8]==="-";return Object.keys(Ob).reduce(function(U,J){var W=Ob[J],_=w[W];if(!_)return U;if(_=J==="milliseconds"?xw(_):parseInt(_,10),!_)return U;if($&&~hw.indexOf(J))_*=-1;return U[J]=_,U},{})}});var kb=M((xY,Cb)=>{Cb.exports=function b(w){if(/^\\x/.test(w))return new Buffer(w.substr(2),"hex");var $="",U=0;while(U<w.length)if(w[U]!=="\\")$+=w[U],++U;else if(/[0-7]{3}/.test(w.substr(U+1,3)))$+=String.fromCharCode(parseInt(w.substr(U+1,3),8)),U+=4;else{var J=1;while(U+J<w.length&&w[U+J]==="\\")J++;for(var W=0;W<Math.floor(J/2);++W)$+="\\";U+=Math.floor(J/2)*2}return new Buffer($,"binary")}});var xb=M((fY,hb)=>{var k1=H5(),P1=j5(),X2=Sb(),Ib=Eb(),Tb=kb();function G2(b){return function w($){if($===null)return $;return b($)}}function vb(b){if(b===null)return b;return b==="TRUE"||b==="t"||b==="true"||b==="y"||b==="yes"||b==="on"||b==="1"}function Zw(b){if(!b)return null;return k1.parse(b,vb)}function gw(b){return parseInt(b,10)}function R5(b){if(!b)return null;return k1.parse(b,G2(gw))}function mw(b){if(!b)return null;return k1.parse(b,G2(function(w){return lb(w).trim()}))}var rw=function(b){if(!b)return null;var w=P1.create(b,function($){if($!==null)$=c5($);return $});return w.parse()},M5=function(b){if(!b)return null;var w=P1.create(b,function($){if($!==null)$=parseFloat($);return $});return w.parse()},$0=function(b){if(!b)return null;var w=P1.create(b);return w.parse()},N5=function(b){if(!b)return null;var w=P1.create(b,function($){if($!==null)$=X2($);return $});return w.parse()},yw=function(b){if(!b)return null;var w=P1.create(b,function($){if($!==null)$=Ib($);return $});return w.parse()},dw=function(b){if(!b)return null;return k1.parse(b,G2(Tb))},A5=function(b){return parseInt(b,10)},lb=function(b){var w=String(b);if(/^\d+$/.test(w))return w;return b},Pb=function(b){if(!b)return null;return k1.parse(b,G2(JSON.parse))},c5=function(b){if(b[0]!=="(")return null;return b=b.substring(1,b.length-1).split(","),{x:parseFloat(b[0]),y:parseFloat(b[1])}},aw=function(b){if(b[0]!=="<"&&b[1]!=="(")return null;var w="(",$="",U=!1;for(var J=2;J<b.length-1;J++){if(!U)w+=b[J];if(b[J]===")"){U=!0;continue}else if(!U)continue;if(b[J]===",")continue;$+=b[J]}var W=c5(w);return W.radius=parseFloat($),W},uw=function(b){b(20,lb),b(21,A5),b(23,A5),b(26,A5),b(700,parseFloat),b(701,parseFloat),b(16,vb),b(1082,X2),b(1114,X2),b(1184,X2),b(600,c5),b(651,$0),b(718,aw),b(1000,Zw),b(1001,dw),b(1005,R5),b(1007,R5),b(1028,R5),b(1016,mw),b(1017,rw),b(1021,M5),b(1022,M5),b(1231,M5),b(1014,$0),b(1015,$0),b(1008,$0),b(1009,$0),b(1040,$0),b(1041,$0),b(1115,N5),b(1182,N5),b(1185,N5),b(1186,Ib),b(1187,yw),b(17,Tb),b(114,JSON.parse.bind(JSON)),b(3802,JSON.parse.bind(JSON)),b(199,Pb),b(3807,Pb),b(3907,$0),b(2951,$0),b(791,$0),b(1183,$0),b(1270,$0)};hb.exports={init:uw}});var Zb=M((ZY,fb)=>{var n=1e6;function pw(b){var w=b.readInt32BE(0),$=b.readUInt32BE(4),U="";if(w<0)w=~w+($===0),$=~$+1>>>0,U="-";var J="",W,_,X,G,Q,H;{if(W=w%n,w=w/n>>>0,_=4294967296*W+$,$=_/n>>>0,X=""+(_-n*$),$===0&&w===0)return U+X+J;G="",Q=6-X.length;for(H=0;H<Q;H++)G+="0";J=G+X+J}{if(W=w%n,w=w/n>>>0,_=4294967296*W+$,$=_/n>>>0,X=""+(_-n*$),$===0&&w===0)return U+X+J;G="",Q=6-X.length;for(H=0;H<Q;H++)G+="0";J=G+X+J}{if(W=w%n,w=w/n>>>0,_=4294967296*W+$,$=_/n>>>0,X=""+(_-n*$),$===0&&w===0)return U+X+J;G="",Q=6-X.length;for(H=0;H<Q;H++)G+="0";J=G+X+J}return W=w%n,_=4294967296*W+$,X=""+_%n,U+X+J}fb.exports=pw});var db=M((gY,yb)=>{var ow=Zb(),T=function(b,w,$,U,J){$=$||0,U=U||!1,J=J||function(B,O,P){return B*Math.pow(2,P)+O};var W=$>>3,_=function(B){if(U)return~B&255;return B},X=255,G=8-$%8;if(w<G)X=255<<8-w&255,G=w;if($)X=X>>$%8;var Q=0;if($%8+w>=8)Q=J(0,_(b[W])&X,G);var H=w+$>>3;for(var z=W+1;z<H;z++)Q=J(Q,_(b[z]),8);var N=(w+$)%8;if(N>0)Q=J(Q,_(b[H])>>8-N,N);return Q},rb=function(b,w,$){var U=Math.pow(2,$-1)-1,J=T(b,1),W=T(b,$,1);if(W===0)return 0;var _=1,X=function(Q,H,z){if(Q===0)Q=1;for(var N=1;N<=z;N++)if(_/=2,(H&1<<z-N)>0)Q+=_;return Q},G=T(b,w,$+1,!1,X);if(W==Math.pow(2,$+1)-1){if(G===0)return J===0?1/0:-1/0;return NaN}return(J===0?1:-1)*Math.pow(2,W-U)*G},nw=function(b){if(T(b,1)==1)return-1*(T(b,15,1,!0)+1);return T(b,15,1)},gb=function(b){if(T(b,1)==1)return-1*(T(b,31,1,!0)+1);return T(b,31,1)},iw=function(b){return rb(b,23,8)},sw=function(b){return rb(b,52,11)},tw=function(b){var w=T(b,16,32);if(w==49152)return NaN;var $=Math.pow(1e4,T(b,16,16)),U=0,J=[],W=T(b,16);for(var _=0;_<W;_++)U+=T(b,16,64+16*_)*$,$/=1e4;var X=Math.pow(10,T(b,16,48));return(w===0?1:-1)*Math.round(U*X)/X},mb=function(b,w){var $=T(w,1),U=T(w,63,1),J=new Date(($===0?1:-1)*U/1000+946684800000);if(!b)J.setTime(J.getTime()+J.getTimezoneOffset()*60000);return J.usec=U%1000,J.getMicroSeconds=function(){return this.usec},J.setMicroSeconds=function(W){this.usec=W},J.getUTCMicroSeconds=function(){return this.usec},J},I1=function(b){var w=T(b,32),$=T(b,32,32),U=T(b,32,64),J=96,W=[];for(var _=0;_<w;_++)W[_]=T(b,32,J),J+=32,J+=32;var X=function(Q){var H=T(b,32,J);if(J+=32,H==4294967295)return null;var z;if(Q==23||Q==20)return z=T(b,H*8,J),J+=H*8,z;else if(Q==25)return z=b.toString(this.encoding,J>>3,(J+=H<<3)>>3),z;else console.log("ERROR: ElementType not implemented: "+Q)},G=function(Q,H){var z=[],N;if(Q.length>1){var B=Q.shift();for(N=0;N<B;N++)z[N]=G(Q,H);Q.unshift(B)}else for(N=0;N<Q[0];N++)z[N]=X(H);return z};return G(W,U)},ew=function(b){return b.toString("utf8")},b$=function(b){if(b===null)return null;return T(b,8)>0},w$=function(b){b(20,ow),b(21,nw),b(23,gb),b(26,gb),b(1700,tw),b(700,iw),b(701,sw),b(16,b$),b(1114,mb.bind(null,!1)),b(1184,mb.bind(null,!0)),b(1000,I1),b(1007,I1),b(1016,I1),b(1008,I1),b(1009,I1),b(25,ew)};yb.exports={init:w$}});var ub=M((mY,ab)=>{ab.exports={BOOL:16,BYTEA:17,CHAR:18,INT8:20,INT2:21,INT4:23,REGPROC:24,TEXT:25,OID:26,TID:27,XID:28,CID:29,JSON:114,XML:142,PG_NODE_TREE:194,SMGR:210,PATH:602,POLYGON:604,CIDR:650,FLOAT4:700,FLOAT8:701,ABSTIME:702,RELTIME:703,TINTERVAL:704,CIRCLE:718,MACADDR8:774,MONEY:790,MACADDR:829,INET:869,ACLITEM:1033,BPCHAR:1042,VARCHAR:1043,DATE:1082,TIME:1083,TIMESTAMP:1114,TIMESTAMPTZ:1184,INTERVAL:1186,TIMETZ:1266,BIT:1560,VARBIT:1562,NUMERIC:1700,REFCURSOR:1790,REGPROCEDURE:2202,REGOPER:2203,REGOPERATOR:2204,REGCLASS:2205,REGTYPE:2206,UUID:2950,TXID_SNAPSHOT:2970,PG_LSN:3220,PG_NDISTINCT:3361,PG_DEPENDENCIES:3402,TSVECTOR:3614,TSQUERY:3615,GTSVECTOR:3642,REGCONFIG:3734,REGDICTIONARY:3769,JSONB:3802,REGNAMESPACE:4089,REGROLE:4096}});var v1=M((G$)=>{var $$=xb(),U$=db(),J$=j5(),W$=ub();G$.getTypeParser=_$;G$.setTypeParser=X$;G$.arrayParser=J$;G$.builtins=W$;var T1={text:{},binary:{}};function pb(b){return String(b)}function _$(b,w){if(w=w||"text",!T1[w])return pb;return T1[w][b]||pb}function X$(b,w,$){if(typeof w=="function")$=w,w="text";T1[w][b]=$}$$.init(function(b,w){T1.text[b]=w});U$.init(function(b,w){T1.binary[b]=w})});var l1=M((yY,L5)=>{L5.exports={host:"localhost",user:process.platform==="win32"?process.env.USERNAME:process.env.USER,database:void 0,password:null,connectionString:void 0,port:5432,rows:0,binary:!1,max:10,idleTimeoutMillis:30000,client_encoding:"",ssl:!1,application_name:void 0,fallback_application_name:void 0,options:void 0,parseInputDatesAsUTC:!1,statement_timeout:!1,lock_timeout:!1,idle_in_transaction_session_timeout:!1,query_timeout:!1,connect_timeout:0,keepalives:1,keepalives_idle:0};var q1=v1(),q$=q1.getTypeParser(20,"text"),z$=q1.getTypeParser(1016,"text");L5.exports.__defineSetter__("parseInt8",function(b){q1.setTypeParser(20,"text",b?q1.getTypeParser(23,"text"):q$),q1.setTypeParser(1016,"text",b?q1.getTypeParser(1007,"text"):z$)})});var z1=M((dY,nb)=>{var R$=l1();function M$(b){return'"'+b.replace(/\\/g,"\\\\").replace(/"/g,"\\\"")+'"'}function ob(b){let w="{";for(let $=0;$<b.length;$++){if($>0)w=w+",";if(b[$]===null||typeof b[$]==="undefined")w=w+"NULL";else if(Array.isArray(b[$]))w=w+ob(b[$]);else if(ArrayBuffer.isView(b[$])){let U=b[$];if(!(U instanceof Buffer)){let J=Buffer.from(U.buffer,U.byteOffset,U.byteLength);if(J.length===U.byteLength)U=J;else U=J.slice(U.byteOffset,U.byteOffset+U.byteLength)}w+="\\\\x"+U.toString("hex")}else w+=M$(Q2(b[$]))}return w=w+"}",w}var Q2=function(b,w){if(b==null)return null;if(typeof b==="object"){if(b instanceof Buffer)return b;if(ArrayBuffer.isView(b)){let $=Buffer.from(b.buffer,b.byteOffset,b.byteLength);if($.length===b.byteLength)return $;return $.slice(b.byteOffset,b.byteOffset+b.byteLength)}if(b instanceof Date)if(R$.parseInputDatesAsUTC)return c$(b);else return A$(b);if(Array.isArray(b))return ob(b);return N$(b,w)}return b.toString()};function N$(b,w){if(b&&typeof b.toPostgres==="function"){if(w=w||[],w.indexOf(b)!==-1)throw new Error('circular reference detected while preparing "'+b+'" for query');return w.push(b),Q2(b.toPostgres(Q2),w)}return JSON.stringify(b)}function A$(b){let w=-b.getTimezoneOffset(),$=b.getFullYear(),U=$<1;if(U)$=Math.abs($)+1;let J=String($).padStart(4,"0")+"-"+String(b.getMonth()+1).padStart(2,"0")+"-"+String(b.getDate()).padStart(2,"0")+"T"+String(b.getHours()).padStart(2,"0")+":"+String(b.getMinutes()).padStart(2,"0")+":"+String(b.getSeconds()).padStart(2,"0")+"."+String(b.getMilliseconds()).padStart(3,"0");if(w<0)J+="-",w*=-1;else J+="+";if(J+=String(Math.floor(w/60)).padStart(2,"0")+":"+String(w%60).padStart(2,"0"),U)J+=" BC";return J}function c$(b){let w=b.getUTCFullYear(),$=w<1;if($)w=Math.abs(w)+1;let U=String(w).padStart(4,"0")+"-"+String(b.getUTCMonth()+1).padStart(2,"0")+"-"+String(b.getUTCDate()).padStart(2,"0")+"T"+String(b.getUTCHours()).padStart(2,"0")+":"+String(b.getUTCMinutes()).padStart(2,"0")+":"+String(b.getUTCSeconds()).padStart(2,"0")+"."+String(b.getUTCMilliseconds()).padStart(3,"0");if(U+="+00:00",$)U+=" BC";return U}function L$(b,w,$){if(b=typeof b==="string"?{text:b}:b,w)if(typeof w==="function")b.callback=w;else b.values=w;if($)b.callback=$;return b}var V$=function(b){return'"'+b.replace(/"/g,'""')+'"'},B$=function(b){let w=!1,$="'";for(let U=0;U<b.length;U++){let J=b[U];if(J==="'")$+=J+J;else if(J==="\\")$+=J+J,w=!0;else $+=J}if($+="'",w===!0)$=" E"+$;return $};nb.exports={prepareValue:function b(w){return Q2(w)},normalizeQueryConfig:L$,escapeIdentifier:V$,escapeLiteral:B$}});var sb=M((aY,ib)=>{var R1=S("crypto");function V5(b){return R1.createHash("md5").update(b,"utf-8").digest("hex")}function S$(b,w,$){let U=V5(w+b);return"md5"+V5(Buffer.concat([Buffer.from(U),$]))}function K$(b){return R1.createHash("sha256").update(b).digest()}function D$(b,w){return b=b.replace(/(\D)-/,"$1"),R1.createHash(b).update(w).digest()}function O$(b,w){return R1.createHmac("sha256",b).update(w).digest()}async function F$(b,w,$){return R1.pbkdf2Sync(b,w,$,32,"sha256")}ib.exports={postgresMd5PasswordHash:S$,randomBytes:R1.randomBytes,deriveKey:F$,sha256:K$,hashByName:D$,hmacSha256:O$,md5:V5}});var w8=M((uY,b8)=>{var tb=S("crypto");b8.exports={postgresMd5PasswordHash:C$,randomBytes:E$,deriveKey:T$,sha256:k$,hashByName:P$,hmacSha256:I$,md5:B5};var eb=tb.webcrypto||globalThis.crypto,m0=eb.subtle,S5=new TextEncoder;function E$(b){return eb.getRandomValues(Buffer.alloc(b))}async function B5(b){try{return tb.createHash("md5").update(b,"utf-8").digest("hex")}catch(w){let $=typeof b==="string"?S5.encode(b):b,U=await m0.digest("MD5",$);return Array.from(new Uint8Array(U)).map((J)=>J.toString(16).padStart(2,"0")).join("")}}async function C$(b,w,$){let U=await B5(w+b);return"md5"+await B5(Buffer.concat([Buffer.from(U),$]))}async function k$(b){return await m0.digest("SHA-256",b)}async function P$(b,w){return await m0.digest(b,w)}async function I$(b,w){let $=await m0.importKey("raw",b,{name:"HMAC",hash:"SHA-256"},!1,["sign"]);return await m0.sign("HMAC",$,S5.encode(w))}async function T$(b,w,$){let U=await m0.importKey("raw",S5.encode(b),"PBKDF2",!1,["deriveBits"]),J={name:"PBKDF2",hash:"SHA-256",salt:w,iterations:$};return await m0.deriveBits(J,U,256,["deriveBits"])}});var D5=M((pY,K5)=>{var v$=parseInt(process.versions&&process.versions.node&&process.versions.node.split(".")[0])<15;if(v$)K5.exports=sb();else K5.exports=w8()});var J8=M((oY,U8)=>{function r0(b,w){return new Error("SASL channel binding: "+b+" when parsing public certificate "+w.toString("base64"))}function O5(b,w){let $=b[w++];if($<128)return{length:$,index:w};let U=$&127;if(U>4)throw r0("bad length",b);$=0;for(let J=0;J<U;J++)$=$<<8|b[w++];return{length:$,index:w}}function $8(b,w){if(b[w++]!==6)throw r0("non-OID data",b);let{length:$,index:U}=O5(b,w);w=U;let J=w+$,W=b[w++],_=(W/40>>0)+"."+W%40;while(w<J){let X=0;while(w<J){let G=b[w++];if(X=X<<7|G&127,G<128)break}_+="."+X}return{oid:_,index:w}}function h1(b,w){if(b[w++]!==48)throw r0("non-sequence data",b);return O5(b,w)}function l$(b,w){if(w===void 0)w=0;w=h1(b,w).index;let{length:$,index:U}=h1(b,w);w=U+$,w=h1(b,w).index;let{oid:J,index:W}=$8(b,w);switch(J){case"1.2.840.113549.1.1.4":return"MD5";case"1.2.840.113549.1.1.5":return"SHA-1";case"1.2.840.113549.1.1.11":return"SHA-256";case"1.2.840.113549.1.1.12":return"SHA-384";case"1.2.840.113549.1.1.13":return"SHA-512";case"1.2.840.113549.1.1.14":return"SHA-224";case"1.2.840.113549.1.1.15":return"SHA512-224";case"1.2.840.113549.1.1.16":return"SHA512-256";case"1.2.840.10045.4.1":return"SHA-1";case"1.2.840.10045.4.3.1":return"SHA-224";case"1.2.840.10045.4.3.2":return"SHA-256";case"1.2.840.10045.4.3.3":return"SHA-384";case"1.2.840.10045.4.3.4":return"SHA-512";case"1.2.840.113549.1.1.10":{if(w=W,w=h1(b,w).index,b[w++]!==160)throw r0("non-tag data",b);w=O5(b,w).index,w=h1(b,w).index;let{oid:_}=$8(b,w);switch(_){case"1.2.840.113549.2.5":return"MD5";case"1.3.14.3.2.26":return"SHA-1";case"2.16.840.1.101.3.4.2.1":return"SHA-256";case"2.16.840.1.101.3.4.2.2":return"SHA-384";case"2.16.840.1.101.3.4.2.3":return"SHA-512"}throw r0("unknown hash OID "+_,b)}case"1.3.101.110":case"1.3.101.112":return"SHA-512";case"1.3.101.111":case"1.3.101.113":throw r0("Ed448 certificate channel binding is not currently supported by Postgres")}throw r0("unknown OID "+J,b)}U8.exports={signatureAlgorithmHashFromCertificate:l$}});var G8=M((nY,X8)=>{var C0=D5(),{signatureAlgorithmHashFromCertificate:h$}=J8();function x$(b,w){let $=["SCRAM-SHA-256"];if(w)$.unshift("SCRAM-SHA-256-PLUS");let U=$.find((_)=>b.includes(_));if(!U)throw new Error("SASL: Only mechanism(s) "+$.join(" and ")+" are supported");if(U==="SCRAM-SHA-256-PLUS"&&typeof w.getPeerCertificate!=="function")throw new Error("SASL: Mechanism SCRAM-SHA-256-PLUS requires a certificate");let J=C0.randomBytes(18).toString("base64");return{mechanism:U,clientNonce:J,response:(U==="SCRAM-SHA-256-PLUS"?"p=tls-server-end-point":w?"y":"n")+",,n=*,r="+J,message:"SASLInitialResponse"}}async function f$(b,w,$,U){if(b.message!=="SASLInitialResponse")throw new Error("SASL: Last message was not SASLInitialResponse");if(typeof w!=="string")throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string");if(w==="")throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string");if(typeof $!=="string")throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: serverData must be a string");let J=m$($);if(!J.nonce.startsWith(b.clientNonce))throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce does not start with client nonce");else if(J.nonce.length===b.clientNonce.length)throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce is too short");let W="n=*,r="+b.clientNonce,_="r="+J.nonce+",s="+J.salt+",i="+J.iteration,X=U?"eSws":"biws";if(b.mechanism==="SCRAM-SHA-256-PLUS"){let L=U.getPeerCertificate().raw,K=h$(L);if(K==="MD5"||K==="SHA-1")K="SHA-256";let C=await C0.hashByName(K,L);X=Buffer.concat([Buffer.from("p=tls-server-end-point,,"),Buffer.from(C)]).toString("base64")}let G="c="+X+",r="+J.nonce,Q=W+","+_+","+G,H=Buffer.from(J.salt,"base64"),z=await C0.deriveKey(w,H,J.iteration),N=await C0.hmacSha256(z,"Client Key"),B=await C0.sha256(N),O=await C0.hmacSha256(B,Q),P=y$(Buffer.from(N),Buffer.from(O)).toString("base64"),x=await C0.hmacSha256(z,"Server Key"),Z=await C0.hmacSha256(x,Q);b.message="SASLResponse",b.serverSignature=Buffer.from(Z).toString("base64"),b.response=G+",p="+P}function Z$(b,w){if(b.message!=="SASLResponse")throw new Error("SASL: Last message was not SASLResponse");if(typeof w!=="string")throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: serverData must be a string");let{serverSignature:$}=r$(w);if($!==b.serverSignature)throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match")}function g$(b){if(typeof b!=="string")throw new TypeError("SASL: text must be a string");return b.split("").map((w,$)=>b.charCodeAt($)).every((w)=>w>=33&&w<=43||w>=45&&w<=126)}function W8(b){return/^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(b)}function _8(b){if(typeof b!=="string")throw new TypeError("SASL: attribute pairs text must be a string");return new Map(b.split(",").map((w)=>{if(!/^.=/.test(w))throw new Error("SASL: Invalid attribute pair entry");let $=w[0],U=w.substring(2);return[$,U]}))}function m$(b){let w=_8(b),$=w.get("r");if(!$)throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce missing");else if(!g$($))throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce must only contain printable characters");let U=w.get("s");if(!U)throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt missing");else if(!W8(U))throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt must be base64");let J=w.get("i");if(!J)throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration missing");else if(!/^[1-9][0-9]*$/.test(J))throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: invalid iteration count");let W=parseInt(J,10);return{nonce:$,salt:U,iteration:W}}function r$(b){let $=_8(b).get("v");if(!$)throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing");else if(!W8($))throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature must be base64");return{serverSignature:$}}function y$(b,w){if(!Buffer.isBuffer(b))throw new TypeError("first argument must be a Buffer");if(!Buffer.isBuffer(w))throw new TypeError("second argument must be a Buffer");if(b.length!==w.length)throw new Error("Buffer lengths must match");if(b.length===0)throw new Error("Buffers cannot be empty");return Buffer.from(b.map(($,U)=>b[U]^w[U]))}X8.exports={startSession:x$,continueSession:f$,finalizeSession:Z$}});var H2=M((iY,Q8)=>{var d$=v1();function Y2(b){this._types=b||d$,this.text={},this.binary={}}Y2.prototype.getOverrides=function(b){switch(b){case"text":return this.text;case"binary":return this.binary;default:return{}}};Y2.prototype.setTypeParser=function(b,w,$){if(typeof w==="function")$=w,w="text";this.getOverrides(w)[b]=$};Y2.prototype.getTypeParser=function(b,w){return w=w||"text",this.getOverrides(w)[b]||this._types.getTypeParser(b,w)};Q8.exports=Y2});var j8=M((sY,H8)=>{function M1(b,w={}){if(b.charAt(0)==="/"){let G=b.split(" ");return{host:G[0],database:G[1]}}let $={},U,J=!1;if(/ |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(b))b=encodeURI(b).replace(/%25(\d\d)/g,"%$1");try{U=new URL(b,"postgres://base")}catch(G){U=new URL(b.replace("@/","@___DUMMY___/"),"postgres://base"),J=!0}for(let G of U.searchParams.entries())$[G[0]]=G[1];if($.user=$.user||decodeURIComponent(U.username),$.password=$.password||decodeURIComponent(U.password),U.protocol=="socket:")return $.host=decodeURI(U.pathname),$.database=U.searchParams.get("db"),$.client_encoding=U.searchParams.get("encoding"),$;let W=J?"":U.hostname;if(!$.host)$.host=decodeURIComponent(W);else if(W&&/^%2f/i.test(W))U.pathname=W+U.pathname;if(!$.port)$.port=U.port;let _=U.pathname.slice(1)||null;if($.database=_?decodeURI(_):null,$.ssl==="true"||$.ssl==="1")$.ssl=!0;if($.ssl==="0")$.ssl=!1;if($.sslcert||$.sslkey||$.sslrootcert||$.sslmode)$.ssl={};let X=$.sslcert||$.sslkey||$.sslrootcert?S("fs"):null;if($.sslcert)$.ssl.cert=X.readFileSync($.sslcert).toString();if($.sslkey)$.ssl.key=X.readFileSync($.sslkey).toString();if($.sslrootcert)$.ssl.ca=X.readFileSync($.sslrootcert).toString();if(w.useLibpqCompat&&$.uselibpqcompat)throw new Error("Both useLibpqCompat and uselibpqcompat are set. Please use only one of them.");if($.uselibpqcompat==="true"||w.useLibpqCompat)switch($.sslmode){case"disable":{$.ssl=!1;break}case"prefer":{$.ssl.rejectUnauthorized=!1;break}case"require":{if($.sslrootcert)$.ssl.checkServerIdentity=function(){};else $.ssl.rejectUnauthorized=!1;break}case"verify-ca":{if(!$.ssl.ca)throw new Error("SECURITY WARNING: Using sslmode=verify-ca requires specifying a CA with sslrootcert. If a public CA is used, verify-ca allows connections to a server that somebody else may have registered with the CA, making you vulnerable to Man-in-the-Middle attacks. Either specify a custom CA certificate with sslrootcert parameter or use sslmode=verify-full for proper security.");$.ssl.checkServerIdentity=function(){};break}case"verify-full":break}else switch($.sslmode){case"disable":{$.ssl=!1;break}case"prefer":case"require":case"verify-ca":case"verify-full":break;case"no-verify":{$.ssl.rejectUnauthorized=!1;break}}return $}function a$(b){return Object.entries(b).reduce(($,[U,J])=>{if(J!==void 0&&J!==null)$[U]=J;return $},{})}function Y8(b){return Object.entries(b).reduce(($,[U,J])=>{if(U==="ssl"){let W=J;if(typeof W==="boolean")$[U]=W;if(typeof W==="object")$[U]=a$(W)}else if(J!==void 0&&J!==null)if(U==="port"){if(J!==""){let W=parseInt(J,10);if(isNaN(W))throw new Error(`Invalid ${U}: ${J}`);$[U]=W}}else $[U]=J;return $},{})}function u$(b){return Y8(M1(b))}H8.exports=M1;M1.parse=M1;M1.toClientConfig=Y8;M1.parseIntoClientConfig=u$});var F5=M((tY,M8)=>{var p$=S("dns"),z8=l1(),q8=j8().parse,p=function(b,w,$){if($===void 0)$=process.env["PG"+b.toUpperCase()];else if($===!1);else $=process.env[$];return w[b]||$||z8[b]},o$=function(){switch(process.env.PGSSLMODE){case"disable":return!1;case"prefer":case"require":case"verify-ca":case"verify-full":return!0;case"no-verify":return{rejectUnauthorized:!1}}return z8.ssl},N1=function(b){return"'"+(""+b).replace(/\\/g,"\\\\").replace(/'/g,"\\'")+"'"},U0=function(b,w,$){let U=w[$];if(U!==void 0&&U!==null)b.push($+"="+N1(U))};class R8{constructor(b){if(b=typeof b==="string"?q8(b):b||{},b.connectionString)b=Object.assign({},b,q8(b.connectionString));if(this.user=p("user",b),this.database=p("database",b),this.database===void 0)this.database=this.user;if(this.port=parseInt(p("port",b),10),this.host=p("host",b),Object.defineProperty(this,"password",{configurable:!0,enumerable:!1,writable:!0,value:p("password",b)}),this.binary=p("binary",b),this.options=p("options",b),this.ssl=typeof b.ssl==="undefined"?o$():b.ssl,typeof this.ssl==="string"){if(this.ssl==="true")this.ssl=!0}if(this.ssl==="no-verify")this.ssl={rejectUnauthorized:!1};if(this.ssl&&this.ssl.key)Object.defineProperty(this.ssl,"key",{enumerable:!1});if(this.client_encoding=p("client_encoding",b),this.replication=p("replication",b),this.isDomainSocket=!(this.host||"").indexOf("/"),this.application_name=p("application_name",b,"PGAPPNAME"),this.fallback_application_name=p("fallback_application_name",b,!1),this.statement_timeout=p("statement_timeout",b,!1),this.lock_timeout=p("lock_timeout",b,!1),this.idle_in_transaction_session_timeout=p("idle_in_transaction_session_timeout",b,!1),this.query_timeout=p("query_timeout",b,!1),b.connectionTimeoutMillis===void 0)this.connect_timeout=process.env.PGCONNECT_TIMEOUT||0;else this.connect_timeout=Math.floor(b.connectionTimeoutMillis/1000);if(b.keepAlive===!1)this.keepalives=0;else if(b.keepAlive===!0)this.keepalives=1;if(typeof b.keepAliveInitialDelayMillis==="number")this.keepalives_idle=Math.floor(b.keepAliveInitialDelayMillis/1000)}getLibpqConnectionString(b){let w=[];U0(w,this,"user"),U0(w,this,"password"),U0(w,this,"port"),U0(w,this,"application_name"),U0(w,this,"fallback_application_name"),U0(w,this,"connect_timeout"),U0(w,this,"options");let $=typeof this.ssl==="object"?this.ssl:this.ssl?{sslmode:this.ssl}:{};if(U0(w,$,"sslmode"),U0(w,$,"sslca"),U0(w,$,"sslkey"),U0(w,$,"sslcert"),U0(w,$,"sslrootcert"),this.database)w.push("dbname="+N1(this.database));if(this.replication)w.push("replication="+N1(this.replication));if(this.host)w.push("host="+N1(this.host));if(this.isDomainSocket)return b(null,w.join(" "));if(this.client_encoding)w.push("client_encoding="+N1(this.client_encoding));p$.lookup(this.host,function(U,J){if(U)return b(U,null);return w.push("hostaddr="+N1(J)),b(null,w.join(" "))})}}M8.exports=R8});var E5=M((eY,c8)=>{var n$=v1(),N8=/^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/;class A8{constructor(b,w){if(this.command=null,this.rowCount=null,this.oid=null,this.rows=[],this.fields=[],this._parsers=void 0,this._types=w,this.RowCtor=null,this.rowAsArray=b==="array",this.rowAsArray)this.parseRow=this._parseRowAsArray;this._prebuiltEmptyResultObject=null}addCommandComplete(b){let w;if(b.text)w=N8.exec(b.text);else w=N8.exec(b.command);if(w){if(this.command=w[1],w[3])this.oid=parseInt(w[2],10),this.rowCount=parseInt(w[3],10);else if(w[2])this.rowCount=parseInt(w[2],10)}}_parseRowAsArray(b){let w=new Array(b.length);for(let $=0,U=b.length;$<U;$++){let J=b[$];if(J!==null)w[$]=this._parsers[$](J);else w[$]=null}return w}parseRow(b){let w={...this._prebuiltEmptyResultObject};for(let $=0,U=b.length;$<U;$++){let J=b[$],W=this.fields[$].name;if(J!==null)w[W]=this._parsers[$](J);else w[W]=null}return w}addRow(b){this.rows.push(b)}addFields(b){if(this.fields=b,this.fields.length)this._parsers=new Array(b.length);let w={};for(let $=0;$<b.length;$++){let U=b[$];if(w[U.name]=null,this._types)this._parsers[$]=this._types.getTypeParser(U.dataTypeID,U.format||"text");else this._parsers[$]=n$.getTypeParser(U.dataTypeID,U.format||"text")}this._prebuiltEmptyResultObject={...w}}}c8.exports=A8});var K8=M((bH,S8)=>{var{EventEmitter:i$}=S("events"),L8=E5(),V8=z1();class B8 extends i${constructor(b,w,$){super();if(b=V8.normalizeQueryConfig(b,w,$),this.text=b.text,this.values=b.values,this.rows=b.rows,this.types=b.types,this.name=b.name,this.queryMode=b.queryMode,this.binary=b.binary,this.portal=b.portal||"",this.callback=b.callback,this._rowMode=b.rowMode,process.domain&&b.callback)this.callback=process.domain.bind(b.callback);this._result=new L8(this._rowMode,this.types),this._results=this._result,this._canceledDueToError=!1}requiresPreparation(){if(this.queryMode==="extended")return!0;if(this.name)return!0;if(this.rows)return!0;if(!this.text)return!1;if(!this.values)return!1;return this.values.length>0}_checkForMultirow(){if(this._result.command){if(!Array.isArray(this._results))this._results=[this._result];this._result=new L8(this._rowMode,this._result._types),this._results.push(this._result)}}handleRowDescription(b){this._checkForMultirow(),this._result.addFields(b.fields),this._accumulateRows=this.callback||!this.listeners("row").length}handleDataRow(b){let w;if(this._canceledDueToError)return;try{w=this._result.parseRow(b.fields)}catch($){this._canceledDueToError=$;return}if(this.emit("row",w,this._result),this._accumulateRows)this._result.addRow(w)}handleCommandComplete(b,w){if(this._checkForMultirow(),this._result.addCommandComplete(b),this.rows)w.sync()}handleEmptyQuery(b){if(this.rows)b.sync()}handleError(b,w){if(this._canceledDueToError)b=this._canceledDueToError,this._canceledDueToError=!1;if(this.callback)return this.callback(b);this.emit("error",b)}handleReadyForQuery(b){if(this._canceledDueToError)return this.handleError(this._canceledDueToError,b);if(this.callback)try{this.callback(null,this._results)}catch(w){process.nextTick(()=>{throw w})}this.emit("end",this._results)}submit(b){if(typeof this.text!=="string"&&typeof this.name!=="string")return new Error("A query must have either text or a name. Supplying neither is unsupported.");let w=b.parsedStatements[this.name];if(this.text&&w&&this.text!==w)return new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);if(this.values&&!Array.isArray(this.values))return new Error("Query values must be an array");if(this.requiresPreparation()){b.stream.cork&&b.stream.cork();try{this.prepare(b)}finally{b.stream.uncork&&b.stream.uncork()}}else b.query(this.text);return null}hasBeenParsed(b){return this.name&&b.parsedStatements[this.name]}handlePortalSuspended(b){this._getRows(b,this.rows)}_getRows(b,w){if(b.execute({portal:this.portal,rows:w}),!w)b.sync();else b.flush()}prepare(b){if(!this.hasBeenParsed(b))b.parse({text:this.text,name:this.name,types:this.types});try{b.bind({portal:this.portal,statement:this.name,values:this.values,binary:this.binary,valueMapper:V8.prepareValue})}catch(w){this.handleError(w,b);return}b.describe({type:"P",name:this.portal||""}),this._getRows(b,this.rows)}handleCopyInResponse(b){b.sendCopyFail("No source stream defined")}handleCopyData(b,w){}}S8.exports=B8});var C5=M((Z8)=>{Object.defineProperty(Z8,"__esModule",{value:!0});Z8.NoticeMessage=Z8.DataRowMessage=Z8.CommandCompleteMessage=Z8.ReadyForQueryMessage=Z8.NotificationResponseMessage=Z8.BackendKeyDataMessage=Z8.AuthenticationMD5Password=Z8.ParameterStatusMessage=Z8.ParameterDescriptionMessage=Z8.RowDescriptionMessage=Z8.Field=Z8.CopyResponse=Z8.CopyDataMessage=Z8.DatabaseError=Z8.copyDone=Z8.emptyQuery=Z8.replicationStart=Z8.portalSuspended=Z8.noData=Z8.closeComplete=Z8.bindComplete=Z8.parseComplete=void 0;Z8.parseComplete={name:"parseComplete",length:5};Z8.bindComplete={name:"bindComplete",length:5};Z8.closeComplete={name:"closeComplete",length:5};Z8.noData={name:"noData",length:5};Z8.portalSuspended={name:"portalSuspended",length:5};Z8.replicationStart={name:"replicationStart",length:4};Z8.emptyQuery={name:"emptyQuery",length:4};Z8.copyDone={name:"copyDone",length:4};class D8 extends Error{constructor(b,w,$){super(b);this.length=w,this.name=$}}Z8.DatabaseError=D8;class O8{constructor(b,w){this.length=b,this.chunk=w,this.name="copyData"}}Z8.CopyDataMessage=O8;class F8{constructor(b,w,$,U){this.length=b,this.name=w,this.binary=$,this.columnTypes=new Array(U)}}Z8.CopyResponse=F8;class E8{constructor(b,w,$,U,J,W,_){this.name=b,this.tableID=w,this.columnID=$,this.dataTypeID=U,this.dataTypeSize=J,this.dataTypeModifier=W,this.format=_}}Z8.Field=E8;class C8{constructor(b,w){this.length=b,this.fieldCount=w,this.name="rowDescription",this.fields=new Array(this.fieldCount)}}Z8.RowDescriptionMessage=C8;class k8{constructor(b,w){this.length=b,this.parameterCount=w,this.name="parameterDescription",this.dataTypeIDs=new Array(this.parameterCount)}}Z8.ParameterDescriptionMessage=k8;class P8{constructor(b,w,$){this.length=b,this.parameterName=w,this.parameterValue=$,this.name="parameterStatus"}}Z8.ParameterStatusMessage=P8;class I8{constructor(b,w){this.length=b,this.salt=w,this.name="authenticationMD5Password"}}Z8.AuthenticationMD5Password=I8;class T8{constructor(b,w,$){this.length=b,this.processID=w,this.secretKey=$,this.name="backendKeyData"}}Z8.BackendKeyDataMessage=T8;class v8{constructor(b,w,$,U){this.length=b,this.processId=w,this.channel=$,this.payload=U,this.name="notification"}}Z8.NotificationResponseMessage=v8;class l8{constructor(b,w){this.length=b,this.status=w,this.name="readyForQuery"}}Z8.ReadyForQueryMessage=l8;class h8{constructor(b,w){this.length=b,this.text=w,this.name="commandComplete"}}Z8.CommandCompleteMessage=h8;class x8{constructor(b,w){this.length=b,this.fields=w,this.name="dataRow",this.fieldCount=w.length}}Z8.DataRowMessage=x8;class f8{constructor(b,w){this.length=b,this.message=w,this.name="notice"}}Z8.NoticeMessage=f8});var d8=M((r8)=>{Object.defineProperty(r8,"__esModule",{value:!0});r8.Writer=void 0;class m8{constructor(b=256){this.size=b,this.offset=5,this.headerPosition=0,this.buffer=Buffer.allocUnsafe(b)}ensure(b){if(this.buffer.length-this.offset<b){let $=this.buffer,U=$.length+($.length>>1)+b;this.buffer=Buffer.allocUnsafe(U),$.copy(this.buffer)}}addInt32(b){return this.ensure(4),this.buffer[this.offset++]=b>>>24&255,this.buffer[this.offset++]=b>>>16&255,this.buffer[this.offset++]=b>>>8&255,this.buffer[this.offset++]=b>>>0&255,this}addInt16(b){return this.ensure(2),this.buffer[this.offset++]=b>>>8&255,this.buffer[this.offset++]=b>>>0&255,this}addCString(b){if(!b)this.ensure(1);else{let w=Buffer.byteLength(b);this.ensure(w+1),this.buffer.write(b,this.offset,"utf-8"),this.offset+=w}return this.buffer[this.offset++]=0,this}addString(b=""){let w=Buffer.byteLength(b);return this.ensure(w),this.buffer.write(b,this.offset),this.offset+=w,this}add(b){return this.ensure(b.length),b.copy(this.buffer,this.offset),this.offset+=b.length,this}join(b){if(b){this.buffer[this.headerPosition]=b;let w=this.offset-(this.headerPosition+1);this.buffer.writeInt32BE(w,this.headerPosition+1)}return this.buffer.slice(b?0:5,this.offset)}flush(b){let w=this.join(b);return this.offset=5,this.headerPosition=0,this.buffer=Buffer.allocUnsafe(this.size),w}}r8.Writer=m8});var o8=M((u8)=>{Object.defineProperty(u8,"__esModule",{value:!0});u8.serialize=void 0;var k5=d8(),v=new k5.Writer,AU=(b)=>{v.addInt16(3).addInt16(0);for(let U of Object.keys(b))v.addCString(U).addCString(b[U]);v.addCString("client_encoding").addCString("UTF8");let w=v.addCString("").flush(),$=w.length+4;return new k5.Writer().addInt32($).add(w).flush()},cU=()=>{let b=Buffer.allocUnsafe(8);return b.writeInt32BE(8,0),b.writeInt32BE(80877103,4),b},LU=(b)=>{return v.addCString(b).flush(112)},VU=function(b,w){return v.addCString(b).addInt32(Buffer.byteLength(w)).addString(w),v.flush(112)},BU=function(b){return v.addString(b).flush(112)},SU=(b)=>{return v.addCString(b).flush(81)},a8=[],KU=(b)=>{let w=b.name||"";if(w.length>63)console.error("Warning! Postgres only supports 63 characters for query names."),console.error("You supplied %s (%s)",w,w.length),console.error("This can cause conflicts and silent errors executing queries");let $=b.types||a8,U=$.length,J=v.addCString(w).addCString(b.text).addInt16(U);for(let W=0;W<U;W++)J.addInt32($[W]);return v.flush(80)},A1=new k5.Writer,DU=function(b,w){for(let $=0;$<b.length;$++){let U=w?w(b[$],$):b[$];if(U==null)v.addInt16(0),A1.addInt32(-1);else if(U instanceof Buffer)v.addInt16(1),A1.addInt32(U.length),A1.add(U);else v.addInt16(0),A1.addInt32(Buffer.byteLength(U)),A1.addString(U)}},OU=(b={})=>{let w=b.portal||"",$=b.statement||"",U=b.binary||!1,J=b.values||a8,W=J.length;return v.addCString(w).addCString($),v.addInt16(W),DU(J,b.valueMapper),v.addInt16(W),v.add(A1.flush()),v.addInt16(U?1:0),v.flush(66)},FU=Buffer.from([69,0,0,0,9,0,0,0,0,0]),EU=(b)=>{if(!b||!b.portal&&!b.rows)return FU;let w=b.portal||"",$=b.rows||0,U=Buffer.byteLength(w),J=4+U+1+4,W=Buffer.allocUnsafe(1+J);return W[0]=69,W.writeInt32BE(J,1),W.write(w,5,"utf-8"),W[U+5]=0,W.writeUInt32BE($,W.length-4),W},CU=(b,w)=>{let $=Buffer.allocUnsafe(16);return $.writeInt32BE(16,0),$.writeInt16BE(1234,4),$.writeInt16BE(5678,6),$.writeInt32BE(b,8),$.writeInt32BE(w,12),$},P5=(b,w)=>{let U=4+Buffer.byteLength(w)+1,J=Buffer.allocUnsafe(1+U);return J[0]=b,J.writeInt32BE(U,1),J.write(w,5,"utf-8"),J[U]=0,J},kU=v.addCString("P").flush(68),PU=v.addCString("S").flush(68),IU=(b)=>{return b.name?P5(68,`${b.type}${b.name||""}`):b.type==="P"?kU:PU},TU=(b)=>{let w=`${b.type}${b.name||""}`;return P5(67,w)},vU=(b)=>{return v.add(b).flush(100)},lU=(b)=>{return P5(102,b)},j2=(b)=>Buffer.from([b,0,0,0,4]),hU=j2(72),xU=j2(83),fU=j2(88),ZU=j2(99),gU={startup:AU,password:LU,requestSsl:cU,sendSASLInitialResponseMessage:VU,sendSCRAMClientFinalMessage:BU,query:SU,parse:KU,bind:OU,execute:EU,describe:IU,close:TU,flush:()=>hU,sync:()=>xU,end:()=>fU,copyData:vU,copyDone:()=>ZU,copyFail:lU,cancel:CU};u8.serialize=gU});var t8=M((i8)=>{Object.defineProperty(i8,"__esModule",{value:!0});i8.BufferReader=void 0;var mU=Buffer.allocUnsafe(0);class n8{constructor(b=0){this.offset=b,this.buffer=mU,this.encoding="utf-8"}setBuffer(b,w){this.offset=b,this.buffer=w}int16(){let b=this.buffer.readInt16BE(this.offset);return this.offset+=2,b}byte(){let b=this.buffer[this.offset];return this.offset++,b}int32(){let b=this.buffer.readInt32BE(this.offset);return this.offset+=4,b}uint32(){let b=this.buffer.readUInt32BE(this.offset);return this.offset+=4,b}string(b){let w=this.buffer.toString(this.encoding,this.offset,this.offset+b);return this.offset+=b,w}cstring(){let b=this.offset,w=b;while(this.buffer[w++]!==0);return this.offset=w,this.buffer.toString(this.encoding,b,w-1)}bytes(b){let w=this.buffer.slice(this.offset,this.offset+b);return this.offset+=b,w}}i8.BufferReader=n8});var J4=M(($4)=>{Object.defineProperty($4,"__esModule",{value:!0});$4.Parser=void 0;var l=C5(),rU=t8(),I5=1,yU=4,e8=I5+yU,b4=Buffer.allocUnsafe(0);class w4{constructor(b){if(this.buffer=b4,this.bufferLength=0,this.bufferOffset=0,this.reader=new rU.BufferReader,(b===null||b===void 0?void 0:b.mode)==="binary")throw new Error("Binary mode not supported yet");this.mode=(b===null||b===void 0?void 0:b.mode)||"text"}parse(b,w){this.mergeBuffer(b);let $=this.bufferOffset+this.bufferLength,U=this.bufferOffset;while(U+e8<=$){let J=this.buffer[U],W=this.buffer.readUInt32BE(U+I5),_=I5+W;if(_+U<=$){let X=this.handlePacket(U+e8,J,W,this.buffer);w(X),U+=_}else break}if(U===$)this.buffer=b4,this.bufferLength=0,this.bufferOffset=0;else this.bufferLength=$-U,this.bufferOffset=U}mergeBuffer(b){if(this.bufferLength>0){let w=this.bufferLength+b.byteLength;if(w+this.bufferOffset>this.buffer.byteLength){let U;if(w<=this.buffer.byteLength&&this.bufferOffset>=this.bufferLength)U=this.buffer;else{let J=this.buffer.byteLength*2;while(w>=J)J*=2;U=Buffer.allocUnsafe(J)}this.buffer.copy(U,0,this.bufferOffset,this.bufferOffset+this.bufferLength),this.buffer=U,this.bufferOffset=0}b.copy(this.buffer,this.bufferOffset+this.bufferLength),this.bufferLength=w}else this.buffer=b,this.bufferOffset=0,this.bufferLength=b.byteLength}handlePacket(b,w,$,U){switch(w){case 50:return l.bindComplete;case 49:return l.parseComplete;case 51:return l.closeComplete;case 110:return l.noData;case 115:return l.portalSuspended;case 99:return l.copyDone;case 87:return l.replicationStart;case 73:return l.emptyQuery;case 68:return this.parseDataRowMessage(b,$,U);case 67:return this.parseCommandCompleteMessage(b,$,U);case 90:return this.parseReadyForQueryMessage(b,$,U);case 65:return this.parseNotificationMessage(b,$,U);case 82:return this.parseAuthenticationResponse(b,$,U);case 83:return this.parseParameterStatusMessage(b,$,U);case 75:return this.parseBackendKeyData(b,$,U);case 69:return this.parseErrorMessage(b,$,U,"error");case 78:return this.parseErrorMessage(b,$,U,"notice");case 84:return this.parseRowDescriptionMessage(b,$,U);case 116:return this.parseParameterDescriptionMessage(b,$,U);case 71:return this.parseCopyInMessage(b,$,U);case 72:return this.parseCopyOutMessage(b,$,U);case 100:return this.parseCopyData(b,$,U);default:return new l.DatabaseError("received invalid response: "+w.toString(16),$,"error")}}parseReadyForQueryMessage(b,w,$){this.reader.setBuffer(b,$);let U=this.reader.string(1);return new l.ReadyForQueryMessage(w,U)}parseCommandCompleteMessage(b,w,$){this.reader.setBuffer(b,$);let U=this.reader.cstring();return new l.CommandCompleteMessage(w,U)}parseCopyData(b,w,$){let U=$.slice(b,b+(w-4));return new l.CopyDataMessage(w,U)}parseCopyInMessage(b,w,$){return this.parseCopyMessage(b,w,$,"copyInResponse")}parseCopyOutMessage(b,w,$){return this.parseCopyMessage(b,w,$,"copyOutResponse")}parseCopyMessage(b,w,$,U){this.reader.setBuffer(b,$);let J=this.reader.byte()!==0,W=this.reader.int16(),_=new l.CopyResponse(w,U,J,W);for(let X=0;X<W;X++)_.columnTypes[X]=this.reader.int16();return _}parseNotificationMessage(b,w,$){this.reader.setBuffer(b,$);let U=this.reader.int32(),J=this.reader.cstring(),W=this.reader.cstring();return new l.NotificationResponseMessage(w,U,J,W)}parseRowDescriptionMessage(b,w,$){this.reader.setBuffer(b,$);let U=this.reader.int16(),J=new l.RowDescriptionMessage(w,U);for(let W=0;W<U;W++)J.fields[W]=this.parseField();return J}parseField(){let b=this.reader.cstring(),w=this.reader.uint32(),$=this.reader.int16(),U=this.reader.uint32(),J=this.reader.int16(),W=this.reader.int32(),_=this.reader.int16()===0?"text":"binary";return new l.Field(b,w,$,U,J,W,_)}parseParameterDescriptionMessage(b,w,$){this.reader.setBuffer(b,$);let U=this.reader.int16(),J=new l.ParameterDescriptionMessage(w,U);for(let W=0;W<U;W++)J.dataTypeIDs[W]=this.reader.int32();return J}parseDataRowMessage(b,w,$){this.reader.setBuffer(b,$);let U=this.reader.int16(),J=new Array(U);for(let W=0;W<U;W++){let _=this.reader.int32();J[W]=_===-1?null:this.reader.string(_)}return new l.DataRowMessage(w,J)}parseParameterStatusMessage(b,w,$){this.reader.setBuffer(b,$);let U=this.reader.cstring(),J=this.reader.cstring();return new l.ParameterStatusMessage(w,U,J)}parseBackendKeyData(b,w,$){this.reader.setBuffer(b,$);let U=this.reader.int32(),J=this.reader.int32();return new l.BackendKeyDataMessage(w,U,J)}parseAuthenticationResponse(b,w,$){this.reader.setBuffer(b,$);let U=this.reader.int32(),J={name:"authenticationOk",length:w};switch(U){case 0:break;case 3:if(J.length===8)J.name="authenticationCleartextPassword";break;case 5:if(J.length===12){J.name="authenticationMD5Password";let W=this.reader.bytes(4);return new l.AuthenticationMD5Password(w,W)}break;case 10:{J.name="authenticationSASL",J.mechanisms=[];let W;do if(W=this.reader.cstring(),W)J.mechanisms.push(W);while(W)}break;case 11:J.name="authenticationSASLContinue",J.data=this.reader.string(w-8);break;case 12:J.name="authenticationSASLFinal",J.data=this.reader.string(w-8);break;default:throw new Error("Unknown authenticationOk message type "+U)}return J}parseErrorMessage(b,w,$,U){this.reader.setBuffer(b,$);let J={},W=this.reader.string(1);while(W!=="\x00")J[W]=this.reader.cstring(),W=this.reader.string(1);let _=J.M,X=U==="notice"?new l.NoticeMessage(w,_):new l.DatabaseError(_,w,U);return X.severity=J.S,X.code=J.C,X.detail=J.D,X.hint=J.H,X.position=J.P,X.internalPosition=J.p,X.internalQuery=J.q,X.where=J.W,X.schema=J.s,X.table=J.t,X.column=J.c,X.dataType=J.d,X.constraint=J.n,X.file=J.F,X.line=J.L,X.routine=J.R,X}}$4.Parser=w4});var T5=M((q2)=>{Object.defineProperty(q2,"__esModule",{value:!0});q2.DatabaseError=q2.serialize=q2.parse=void 0;var dU=C5();Object.defineProperty(q2,"DatabaseError",{enumerable:!0,get:function(){return dU.DatabaseError}});var aU=o8();Object.defineProperty(q2,"serialize",{enumerable:!0,get:function(){return aU.serialize}});var uU=J4();function pU(b,w){let $=new uU.Parser;return b.on("data",(U)=>$.parse(U,w)),new Promise((U)=>b.on("end",()=>U()))}q2.parse=pU});var G4=M((_4)=>{Object.defineProperty(_4,"__esModule",{value:!0});_4.CloudflareSocket=void 0;var iU=S("events");class W4 extends iU.EventEmitter{constructor(b){super();this.ssl=b,this.writable=!1,this.destroyed=!1,this._upgrading=!1,this._upgraded=!1,this._cfSocket=null,this._cfWriter=null,this._cfReader=null}setNoDelay(){return this}setKeepAlive(){return this}ref(){return this}unref(){return this}async connect(b,w,$){try{if(e("connecting"),$)this.once("connect",$);let U=this.ssl?{secureTransport:"starttls"}:{},W=(await import("cloudflare:sockets")).connect;if(this._cfSocket=W(`${w}:${b}`,U),this._cfWriter=this._cfSocket.writable.getWriter(),this._addClosedHandler(),this._cfReader=this._cfSocket.readable.getReader(),this.ssl)this._listenOnce().catch((_)=>this.emit("error",_));else this._listen().catch((_)=>this.emit("error",_));return await this._cfWriter.ready,e("socket ready"),this.writable=!0,this.emit("connect"),this}catch(U){this.emit("error",U)}}async _listen(){while(!0){e("awaiting receive from CF socket");let{done:b,value:w}=await this._cfReader.read();if(e("CF socket received:",b,w),b){e("done");break}this.emit("data",Buffer.from(w))}}async _listenOnce(){e("awaiting first receive from CF socket");let{done:b,value:w}=await this._cfReader.read();e("First CF socket received:",b,w),this.emit("data",Buffer.from(w))}write(b,w="utf8",$=()=>{}){if(b.length===0)return $();if(typeof b==="string")b=Buffer.from(b,w);return e("sending data direct:",b),this._cfWriter.write(b).then(()=>{e("data sent"),$()},(U)=>{e("send error",U),$(U)}),!0}end(b=Buffer.alloc(0),w="utf8",$=()=>{}){return e("ending CF socket"),this.write(b,w,(U)=>{if(this._cfSocket.close(),$)$(U)}),this}destroy(b){return e("destroying CF socket",b),this.destroyed=!0,this.end()}startTls(b){if(this._upgraded){this.emit("error","Cannot call `startTls()` more than once on a socket");return}this._cfWriter.releaseLock(),this._cfReader.releaseLock(),this._upgrading=!0,this._cfSocket=this._cfSocket.startTls(b),this._cfWriter=this._cfSocket.writable.getWriter(),this._cfReader=this._cfSocket.readable.getReader(),this._addClosedHandler(),this._listen().catch((w)=>this.emit("error",w))}_addClosedHandler(){this._cfSocket.closed.then(()=>{if(!this._upgrading)e("CF socket closed"),this._cfSocket=null,this.emit("close");else this._upgrading=!1,this._upgraded=!0}).catch((b)=>this.emit("error",b))}}_4.CloudflareSocket=W4;var sU=!1;function tU(b){if(b instanceof Uint8Array||b instanceof ArrayBuffer){let w=Buffer.from(b).toString("hex");return`
>>> STR: "${new TextDecoder().decode(b).replace(/\n/g,"\\n")}"
>>> HEX: ${w}
`}else return b}function e(...b){sU&&console.log(...b.map(tU))}});var Y4=M((QH,Q4)=>{var{getStream:eU,getSecureStream:bJ}=JJ();Q4.exports={getStream:eU,getSecureStream:bJ};function wJ(){function b($){return new(S("net")).Socket}function w($){return S("tls").connect($)}return{getStream:b,getSecureStream:w}}function $J(){function b($){let{CloudflareSocket:U}=G4();return new U($)}function w($){return $.socket.startTls($),$.socket}return{getStream:b,getSecureStream:w}}function UJ(){if(typeof navigator==="object"&&navigator!==null&&typeof navigator.userAgent==="string")return navigator.userAgent==="Cloudflare-Workers";if(typeof Response==="function"){let b=new Response(null,{cf:{thing:!0}});if(typeof b.cf==="object"&&b.cf!==null&&b.cf.thing)return!0}return!1}function JJ(){if(UJ())return $J();return wJ()}});var v5=M((YH,j4)=>{var WJ=S("events").EventEmitter,{parse:_J,serialize:g}=T5(),{getStream:XJ,getSecureStream:GJ}=Y4(),QJ=g.flush(),YJ=g.sync(),HJ=g.end();class H4 extends WJ{constructor(b){super();if(b=b||{},this.stream=b.stream||XJ(b.ssl),typeof this.stream==="function")this.stream=this.stream(b);this._keepAlive=b.keepAlive,this._keepAliveInitialDelayMillis=b.keepAliveInitialDelayMillis,this.lastBuffer=!1,this.parsedStatements={},this.ssl=b.ssl||!1,this._ending=!1,this._emitMessage=!1;let w=this;this.on("newListener",function($){if($==="message")w._emitMessage=!0})}connect(b,w){let $=this;this._connecting=!0,this.stream.setNoDelay(!0),this.stream.connect(b,w),this.stream.once("connect",function(){if($._keepAlive)$.stream.setKeepAlive(!0,$._keepAliveInitialDelayMillis);$.emit("connect")});let U=function(J){if($._ending&&(J.code==="ECONNRESET"||J.code==="EPIPE"))return;$.emit("error",J)};if(this.stream.on("error",U),this.stream.on("close",function(){$.emit("end")}),!this.ssl)return this.attachListeners(this.stream);this.stream.once("data",function(J){switch(J.toString("utf8")){case"S":break;case"N":return $.stream.end(),$.emit("error",new Error("The server does not support SSL connections"));default:return $.stream.end(),$.emit("error",new Error("There was an error establishing an SSL connection"))}let _={socket:$.stream};if($.ssl!==!0){if(Object.assign(_,$.ssl),"key"in $.ssl)_.key=$.ssl.key}let X=S("net");if(X.isIP&&X.isIP(w)===0)_.servername=w;try{$.stream=GJ(_)}catch(G){return $.emit("error",G)}$.attachListeners($.stream),$.stream.on("error",U),$.emit("sslconnect")})}attachListeners(b){_J(b,(w)=>{let $=w.name==="error"?"errorMessage":w.name;if(this._emitMessage)this.emit("message",w);this.emit($,w)})}requestSsl(){this.stream.write(g.requestSsl())}startup(b){this.stream.write(g.startup(b))}cancel(b,w){this._send(g.cancel(b,w))}password(b){this._send(g.password(b))}sendSASLInitialResponseMessage(b,w){this._send(g.sendSASLInitialResponseMessage(b,w))}sendSCRAMClientFinalMessage(b){this._send(g.sendSCRAMClientFinalMessage(b))}_send(b){if(!this.stream.writable)return!1;return this.stream.write(b)}query(b){this._send(g.query(b))}parse(b){this._send(g.parse(b))}bind(b){this._send(g.bind(b))}execute(b){this._send(g.execute(b))}flush(){if(this.stream.writable)this.stream.write(QJ)}sync(){this._ending=!0,this._send(YJ)}ref(){this.stream.ref()}unref(){this.stream.unref()}end(){if(this._ending=!0,!this._connecting||!this.stream.writable){this.stream.end();return}return this.stream.write(HJ,()=>{this.stream.end()})}close(b){this._send(g.close(b))}describe(b){this._send(g.describe(b))}sendCopyFromChunk(b){this._send(g.copyData(b))}endCopyFrom(){this._send(g.copyDone())}sendCopyFail(b){this._send(g.copyFail(b))}}j4.exports=H4});var M4=M((HH,R4)=>{var{Transform:jJ}=S("stream"),{StringDecoder:qJ}=S("string_decoder"),k0=Symbol("last"),z2=Symbol("decoder");function zJ(b,w,$){let U;if(this.overflow){if(U=this[z2].write(b).split(this.matcher),U.length===1)return $();U.shift(),this.overflow=!1}else this[k0]+=this[z2].write(b),U=this[k0].split(this.matcher);this[k0]=U.pop();for(let J=0;J<U.length;J++)try{z4(this,this.mapper(U[J]))}catch(W){return $(W)}if(this.overflow=this[k0].length>this.maxLength,this.overflow&&!this.skipOverflow){$(new Error("maximum buffer reached"));return}$()}function RJ(b){if(this[k0]+=this[z2].end(),this[k0])try{z4(this,this.mapper(this[k0]))}catch(w){return b(w)}b()}function z4(b,w){if(w!==void 0)b.push(w)}function q4(b){return b}function MJ(b,w,$){switch(b=b||/\r?\n/,w=w||q4,$=$||{},arguments.length){case 1:if(typeof b==="function")w=b,b=/\r?\n/;else if(typeof b==="object"&&!(b instanceof RegExp)&&!b[Symbol.split])$=b,b=/\r?\n/;break;case 2:if(typeof b==="function")$=w,w=b,b=/\r?\n/;else if(typeof w==="object")$=w,w=q4}$=Object.assign({},$),$.autoDestroy=!0,$.transform=zJ,$.flush=RJ,$.readableObjectMode=!0;let U=new jJ($);return U[k0]="",U[z2]=new qJ("utf8"),U.matcher=b,U.mapper=w,U.maxLength=$.maxLength,U.skipOverflow=$.skipOverflow||!1,U.overflow=!1,U._destroy=function(J,W){this._writableState.errorEmitted=!1,W(J)},U}R4.exports=MJ});var c4=M((CJ,V0)=>{var N4=S("path"),NJ=S("stream").Stream,AJ=M4(),A4=S("util"),cJ=5432,R2=process.platform==="win32",x1=process.stderr,LJ=56,VJ=7,BJ=61440,SJ=32768;function KJ(b){return(b&BJ)==SJ}var c1=["host","port","database","user","password"],l5=c1.length,DJ=c1[l5-1];function h5(){var b=x1 instanceof NJ&&x1.writable===!0;if(b){var w=Array.prototype.slice.call(arguments).concat(`
`);x1.write(A4.format.apply(A4,w))}}Object.defineProperty(CJ,"isWin",{get:function(){return R2},set:function(b){R2=b}});CJ.warnTo=function(b){var w=x1;return x1=b,w};CJ.getFileName=function(b){var w=b||process.env,$=w.PGPASSFILE||(R2?N4.join(w.APPDATA||"./","postgresql","pgpass.conf"):N4.join(w.HOME||"./",".pgpass"));return $};CJ.usePgPass=function(b,w){if(Object.prototype.hasOwnProperty.call(process.env,"PGPASSWORD"))return!1;if(R2)return!0;if(w=w||"<unkn>",!KJ(b.mode))return h5('WARNING: password file "%s" is not a plain file',w),!1;if(b.mode&(LJ|VJ))return h5('WARNING: password file "%s" has group or world access; permissions should be u=rw (0600) or less',w),!1;return!0};var OJ=CJ.match=function(b,w){return c1.slice(0,-1).reduce(function($,U,J){if(J==1){if(Number(b[U]||cJ)===Number(w[U]))return $&&!0}return $&&(w[U]==="*"||w[U]===b[U])},!0)};CJ.getPassword=function(b,w,$){var U,J=w.pipe(AJ());function W(G){var Q=FJ(G);if(Q&&EJ(Q)&&OJ(b,Q))U=Q[DJ],J.end()}var _=function(){w.destroy(),$(U)},X=function(G){w.destroy(),h5("WARNING: error on reading file: %s",G),$(void 0)};w.on("error",X),J.on("data",W).on("end",_).on("error",X)};var FJ=CJ.parseLine=function(b){if(b.length<11||b.match(/^\s+#/))return null;var w="",$="",U=0,J=0,W=0,_={},X=!1,G=function(H,z,N){var B=b.substring(z,N);if(!Object.hasOwnProperty.call(process.env,"PGPASS_NO_DEESCAPE"))B=B.replace(/\\([:\\])/g,"$1");_[c1[H]]=B};for(var Q=0;Q<b.length-1;Q+=1){if(w=b.charAt(Q+1),$=b.charAt(Q),X=U==l5-1,X){G(U,J);break}if(Q>=0&&w==":"&&$!=="\\")G(U,J,Q+1),J=Q+2,U+=1}return _=Object.keys(_).length===l5?_:null,_},EJ=CJ.isValidEntry=function(b){var w={0:function(_){return _.length>0},1:function(_){if(_==="*")return!0;return _=Number(_),isFinite(_)&&_>0&&_<9007199254740992&&Math.floor(_)===_},2:function(_){return _.length>0},3:function(_){return _.length>0},4:function(_){return _.length>0}};for(var $=0;$<c1.length;$+=1){var U=w[$],J=b[c1[$]]||"",W=U(J);if(!W)return!1}return!0}});var V4=M((MH,x5)=>{var RH=S("path"),L4=S("fs"),M2=c4();x5.exports=function(b,w){var $=M2.getFileName();L4.stat($,function(U,J){if(U||!M2.usePgPass(J,$))return w(void 0);var W=L4.createReadStream($);M2.getPassword(b,W,w)})};x5.exports.warnTo=M2.warnTo});var D4=M((NH,K4)=>{var vJ=S("events").EventEmitter,B4=z1(),f5=G8(),lJ=H2(),hJ=F5(),S4=K8(),xJ=l1(),fJ=v5(),ZJ=D5();class Z5 extends vJ{constructor(b){super();this.connectionParameters=new hJ(b),this.user=this.connectionParameters.user,this.database=this.connectionParameters.database,this.port=this.connectionParameters.port,this.host=this.connectionParameters.host,Object.defineProperty(this,"password",{configurable:!0,enumerable:!1,writable:!0,value:this.connectionParameters.password}),this.replication=this.connectionParameters.replication;let w=b||{};if(this._Promise=w.Promise||global.Promise,this._types=new lJ(w.types),this._ending=!1,this._ended=!1,this._connecting=!1,this._connected=!1,this._connectionError=!1,this._queryable=!0,this.enableChannelBinding=Boolean(w.enableChannelBinding),this.connection=w.connection||new fJ({stream:w.stream,ssl:this.connectionParameters.ssl,keepAlive:w.keepAlive||!1,keepAliveInitialDelayMillis:w.keepAliveInitialDelayMillis||0,encoding:this.connectionParameters.client_encoding||"utf8"}),this.queryQueue=[],this.binary=w.binary||xJ.binary,this.processID=null,this.secretKey=null,this.ssl=this.connectionParameters.ssl||!1,this.ssl&&this.ssl.key)Object.defineProperty(this.ssl,"key",{enumerable:!1});this._connectionTimeoutMillis=w.connectionTimeoutMillis||0}_errorAllQueries(b){let w=($)=>{process.nextTick(()=>{$.handleError(b,this.connection)})};if(this.activeQuery)w(this.activeQuery),this.activeQuery=null;this.queryQueue.forEach(w),this.queryQueue.length=0}_connect(b){let w=this,$=this.connection;if(this._connectionCallback=b,this._connecting||this._connected){let U=new Error("Client has already been connected. You cannot reuse a client.");process.nextTick(()=>{b(U)});return}if(this._connecting=!0,this._connectionTimeoutMillis>0){if(this.connectionTimeoutHandle=setTimeout(()=>{$._ending=!0,$.stream.destroy(new Error("timeout expired"))},this._connectionTimeoutMillis),this.connectionTimeoutHandle.unref)this.connectionTimeoutHandle.unref()}if(this.host&&this.host.indexOf("/")===0)$.connect(this.host+"/.s.PGSQL."+this.port);else $.connect(this.port,this.host);$.on("connect",function(){if(w.ssl)$.requestSsl();else $.startup(w.getStartupConf())}),$.on("sslconnect",function(){$.startup(w.getStartupConf())}),this._attachListeners($),$.once("end",()=>{let U=this._ending?new Error("Connection terminated"):new Error("Connection terminated unexpectedly");if(clearTimeout(this.connectionTimeoutHandle),this._errorAllQueries(U),this._ended=!0,!this._ending){if(this._connecting&&!this._connectionError)if(this._connectionCallback)this._connectionCallback(U);else this._handleErrorEvent(U);else if(!this._connectionError)this._handleErrorEvent(U)}process.nextTick(()=>{this.emit("end")})})}connect(b){if(b){this._connect(b);return}return new this._Promise((w,$)=>{this._connect((U)=>{if(U)$(U);else w()})})}_attachListeners(b){b.on("authenticationCleartextPassword",this._handleAuthCleartextPassword.bind(this)),b.on("authenticationMD5Password",this._handleAuthMD5Password.bind(this)),b.on("authenticationSASL",this._handleAuthSASL.bind(this)),b.on("authenticationSASLContinue",this._handleAuthSASLContinue.bind(this)),b.on("authenticationSASLFinal",this._handleAuthSASLFinal.bind(this)),b.on("backendKeyData",this._handleBackendKeyData.bind(this)),b.on("error",this._handleErrorEvent.bind(this)),b.on("errorMessage",this._handleErrorMessage.bind(this)),b.on("readyForQuery",this._handleReadyForQuery.bind(this)),b.on("notice",this._handleNotice.bind(this)),b.on("rowDescription",this._handleRowDescription.bind(this)),b.on("dataRow",this._handleDataRow.bind(this)),b.on("portalSuspended",this._handlePortalSuspended.bind(this)),b.on("emptyQuery",this._handleEmptyQuery.bind(this)),b.on("commandComplete",this._handleCommandComplete.bind(this)),b.on("parseComplete",this._handleParseComplete.bind(this)),b.on("copyInResponse",this._handleCopyInResponse.bind(this)),b.on("copyData",this._handleCopyData.bind(this)),b.on("notification",this._handleNotification.bind(this))}_checkPgPass(b){let w=this.connection;if(typeof this.password==="function")this._Promise.resolve().then(()=>this.password()).then(($)=>{if($!==void 0){if(typeof $!=="string"){w.emit("error",new TypeError("Password must be a string"));return}this.connectionParameters.password=this.password=$}else this.connectionParameters.password=this.password=null;b()}).catch(($)=>{w.emit("error",$)});else if(this.password!==null)b();else try{V4()(this.connectionParameters,(U)=>{if(U!==void 0)this.connectionParameters.password=this.password=U;b()})}catch($){this.emit("error",$)}}_handleAuthCleartextPassword(b){this._checkPgPass(()=>{this.connection.password(this.password)})}_handleAuthMD5Password(b){this._checkPgPass(async()=>{try{let w=await ZJ.postgresMd5PasswordHash(this.user,this.password,b.salt);this.connection.password(w)}catch(w){this.emit("error",w)}})}_handleAuthSASL(b){this._checkPgPass(()=>{try{this.saslSession=f5.startSession(b.mechanisms,this.enableChannelBinding&&this.connection.stream),this.connection.sendSASLInitialResponseMessage(this.saslSession.mechanism,this.saslSession.response)}catch(w){this.connection.emit("error",w)}})}async _handleAuthSASLContinue(b){try{await f5.continueSession(this.saslSession,this.password,b.data,this.enableChannelBinding&&this.connection.stream),this.connection.sendSCRAMClientFinalMessage(this.saslSession.response)}catch(w){this.connection.emit("error",w)}}_handleAuthSASLFinal(b){try{f5.finalizeSession(this.saslSession,b.data),this.saslSession=null}catch(w){this.connection.emit("error",w)}}_handleBackendKeyData(b){this.processID=b.processID,this.secretKey=b.secretKey}_handleReadyForQuery(b){if(this._connecting){if(this._connecting=!1,this._connected=!0,clearTimeout(this.connectionTimeoutHandle),this._connectionCallback)this._connectionCallback(null,this),this._connectionCallback=null;this.emit("connect")}let{activeQuery:w}=this;if(this.activeQuery=null,this.readyForQuery=!0,w)w.handleReadyForQuery(this.connection);this._pulseQueryQueue()}_handleErrorWhileConnecting(b){if(this._connectionError)return;if(this._connectionError=!0,clearTimeout(this.connectionTimeoutHandle),this._connectionCallback)return this._connectionCallback(b);this.emit("error",b)}_handleErrorEvent(b){if(this._connecting)return this._handleErrorWhileConnecting(b);this._queryable=!1,this._errorAllQueries(b),this.emit("error",b)}_handleErrorMessage(b){if(this._connecting)return this._handleErrorWhileConnecting(b);let w=this.activeQuery;if(!w){this._handleErrorEvent(b);return}this.activeQuery=null,w.handleError(b,this.connection)}_handleRowDescription(b){this.activeQuery.handleRowDescription(b)}_handleDataRow(b){this.activeQuery.handleDataRow(b)}_handlePortalSuspended(b){this.activeQuery.handlePortalSuspended(this.connection)}_handleEmptyQuery(b){this.activeQuery.handleEmptyQuery(this.connection)}_handleCommandComplete(b){if(this.activeQuery==null){let w=new Error("Received unexpected commandComplete message from backend.");this._handleErrorEvent(w);return}this.activeQuery.handleCommandComplete(b,this.connection)}_handleParseComplete(){if(this.activeQuery==null){let b=new Error("Received unexpected parseComplete message from backend.");this._handleErrorEvent(b);return}if(this.activeQuery.name)this.connection.parsedStatements[this.activeQuery.name]=this.activeQuery.text}_handleCopyInResponse(b){this.activeQuery.handleCopyInResponse(this.connection)}_handleCopyData(b){this.activeQuery.handleCopyData(b,this.connection)}_handleNotification(b){this.emit("notification",b)}_handleNotice(b){this.emit("notice",b)}getStartupConf(){let b=this.connectionParameters,w={user:b.user,database:b.database},$=b.application_name||b.fallback_application_name;if($)w.application_name=$;if(b.replication)w.replication=""+b.replication;if(b.statement_timeout)w.statement_timeout=String(parseInt(b.statement_timeout,10));if(b.lock_timeout)w.lock_timeout=String(parseInt(b.lock_timeout,10));if(b.idle_in_transaction_session_timeout)w.idle_in_transaction_session_timeout=String(parseInt(b.idle_in_transaction_session_timeout,10));if(b.options)w.options=b.options;return w}cancel(b,w){if(b.activeQuery===w){let $=this.connection;if(this.host&&this.host.indexOf("/")===0)$.connect(this.host+"/.s.PGSQL."+this.port);else $.connect(this.port,this.host);$.on("connect",function(){$.cancel(b.processID,b.secretKey)})}else if(b.queryQueue.indexOf(w)!==-1)b.queryQueue.splice(b.queryQueue.indexOf(w),1)}setTypeParser(b,w,$){return this._types.setTypeParser(b,w,$)}getTypeParser(b,w){return this._types.getTypeParser(b,w)}escapeIdentifier(b){return B4.escapeIdentifier(b)}escapeLiteral(b){return B4.escapeLiteral(b)}_pulseQueryQueue(){if(this.readyForQuery===!0){if(this.activeQuery=this.queryQueue.shift(),this.activeQuery){this.readyForQuery=!1,this.hasExecuted=!0;let b=this.activeQuery.submit(this.connection);if(b)process.nextTick(()=>{this.activeQuery.handleError(b,this.connection),this.readyForQuery=!0,this._pulseQueryQueue()})}else if(this.hasExecuted)this.activeQuery=null,this.emit("drain")}}query(b,w,$){let U,J,W,_,X;if(b===null||b===void 0)throw new TypeError("Client was passed a null or undefined query");else if(typeof b.submit==="function"){if(W=b.query_timeout||this.connectionParameters.query_timeout,J=U=b,typeof w==="function")U.callback=U.callback||w}else if(W=b.query_timeout||this.connectionParameters.query_timeout,U=new S4(b,w,$),!U.callback)J=new this._Promise((G,Q)=>{U.callback=(H,z)=>H?Q(H):G(z)}).catch((G)=>{throw Error.captureStackTrace(G),G});if(W)X=U.callback,_=setTimeout(()=>{let G=new Error("Query read timeout");process.nextTick(()=>{U.handleError(G,this.connection)}),X(G),U.callback=()=>{};let Q=this.queryQueue.indexOf(U);if(Q>-1)this.queryQueue.splice(Q,1);this._pulseQueryQueue()},W),U.callback=(G,Q)=>{clearTimeout(_),X(G,Q)};if(this.binary&&!U.binary)U.binary=!0;if(U._result&&!U._result._types)U._result._types=this._types;if(!this._queryable)return process.nextTick(()=>{U.handleError(new Error("Client has encountered a connection error and is not queryable"),this.connection)}),J;if(this._ending)return process.nextTick(()=>{U.handleError(new Error("Client was closed and is not queryable"),this.connection)}),J;return this.queryQueue.push(U),this._pulseQueryQueue(),J}ref(){this.connection.ref()}unref(){this.connection.unref()}end(b){if(this._ending=!0,!this.connection._connecting||this._ended)if(b)b();else return this._Promise.resolve();if(this.activeQuery||!this._queryable)this.connection.stream.destroy();else this.connection.end();if(b)this.connection.once("end",b);else return new this._Promise((w)=>{this.connection.once("end",w)})}}Z5.Query=S4;K4.exports=Z5});var P4=M((AH,k4)=>{var gJ=S("events").EventEmitter,O4=function(){},F4=(b,w)=>{let $=b.findIndex(w);return $===-1?void 0:b.splice($,1)[0]};class E4{constructor(b,w,$){this.client=b,this.idleListener=w,this.timeoutId=$}}class f1{constructor(b){this.callback=b}}function mJ(){throw new Error("Release called on client which has already been released to the pool.")}function N2(b,w){if(w)return{callback:w,result:void 0};let $,U,J=function(_,X){_?$(_):U(X)},W=new b(function(_,X){U=_,$=X}).catch((_)=>{throw Error.captureStackTrace(_),_});return{callback:J,result:W}}function rJ(b,w){return function $(U){U.client=w,w.removeListener("error",$),w.on("error",()=>{b.log("additional client error after disconnection due to error",U)}),b._remove(w),b.emit("error",U,w)}}class C4 extends gJ{constructor(b,w){super();if(this.options=Object.assign({},b),b!=null&&"password"in b)Object.defineProperty(this.options,"password",{configurable:!0,enumerable:!1,writable:!0,value:b.password});if(b!=null&&b.ssl&&b.ssl.key)Object.defineProperty(this.options.ssl,"key",{enumerable:!1});if(this.options.max=this.options.max||this.options.poolSize||10,this.options.min=this.options.min||0,this.options.maxUses=this.options.maxUses||1/0,this.options.allowExitOnIdle=this.options.allowExitOnIdle||!1,this.options.maxLifetimeSeconds=this.options.maxLifetimeSeconds||0,this.log=this.options.log||function(){},this.Client=this.options.Client||w||g5().Client,this.Promise=this.options.Promise||global.Promise,typeof this.options.idleTimeoutMillis==="undefined")this.options.idleTimeoutMillis=1e4;this._clients=[],this._idle=[],this._expired=new WeakSet,this._pendingQueue=[],this._endCallback=void 0,this.ending=!1,this.ended=!1}_isFull(){return this._clients.length>=this.options.max}_isAboveMin(){return this._clients.length>this.options.min}_pulseQueue(){if(this.log("pulse queue"),this.ended){this.log("pulse queue ended");return}if(this.ending){if(this.log("pulse queue on ending"),this._idle.length)this._idle.slice().map((w)=>{this._remove(w.client)});if(!this._clients.length)this.ended=!0,this._endCallback();return}if(!this._pendingQueue.length){this.log("no queued requests");return}if(!this._idle.length&&this._isFull())return;let b=this._pendingQueue.shift();if(this._idle.length){let w=this._idle.pop();clearTimeout(w.timeoutId);let $=w.client;$.ref&&$.ref();let U=w.idleListener;return this._acquireClient($,b,U,!1)}if(!this._isFull())return this.newClient(b);throw new Error("unexpected condition")}_remove(b){let w=F4(this._idle,($)=>$.client===b);if(w!==void 0)clearTimeout(w.timeoutId);this._clients=this._clients.filter(($)=>$!==b),b.end(),this.emit("remove",b)}connect(b){if(this.ending){let U=new Error("Cannot use a pool after calling end on the pool");return b?b(U):this.Promise.reject(U)}let w=N2(this.Promise,b),$=w.result;if(this._isFull()||this._idle.length){if(this._idle.length)process.nextTick(()=>this._pulseQueue());if(!this.options.connectionTimeoutMillis)return this._pendingQueue.push(new f1(w.callback)),$;let U=(_,X,G)=>{clearTimeout(W),w.callback(_,X,G)},J=new f1(U),W=setTimeout(()=>{F4(this._pendingQueue,(_)=>_.callback===U),J.timedOut=!0,w.callback(new Error("timeout exceeded when trying to connect"))},this.options.connectionTimeoutMillis);if(W.unref)W.unref();return this._pendingQueue.push(J),$}return this.newClient(new f1(w.callback)),$}newClient(b){let w=new this.Client(this.options);this._clients.push(w);let $=rJ(this,w);this.log("checking client timeout");let U,J=!1;if(this.options.connectionTimeoutMillis)U=setTimeout(()=>{this.log("ending client due to timeout"),J=!0,w.connection?w.connection.stream.destroy():w.end()},this.options.connectionTimeoutMillis);this.log("connecting new client"),w.connect((W)=>{if(U)clearTimeout(U);if(w.on("error",$),W){if(this.log("client failed to connect",W),this._clients=this._clients.filter((_)=>_!==w),J)W=new Error("Connection terminated due to connection timeout",{cause:W});if(this._pulseQueue(),!b.timedOut)b.callback(W,void 0,O4)}else{if(this.log("new client connected"),this.options.maxLifetimeSeconds!==0){let _=setTimeout(()=>{if(this.log("ending client due to expired lifetime"),this._expired.add(w),this._idle.findIndex((G)=>G.client===w)!==-1)this._acquireClient(w,new f1((G,Q,H)=>H()),$,!1)},this.options.maxLifetimeSeconds*1000);_.unref(),w.once("end",()=>clearTimeout(_))}return this._acquireClient(w,b,$,!0)}})}_acquireClient(b,w,$,U){if(U)this.emit("connect",b);if(this.emit("acquire",b),b.release=this._releaseOnce(b,$),b.removeListener("error",$),!w.timedOut)if(U&&this.options.verify)this.options.verify(b,(J)=>{if(J)return b.release(J),w.callback(J,void 0,O4);w.callback(void 0,b,b.release)});else w.callback(void 0,b,b.release);else if(U&&this.options.verify)this.options.verify(b,b.release);else b.release()}_releaseOnce(b,w){let $=!1;return(U)=>{if($)mJ();$=!0,this._release(b,w,U)}}_release(b,w,$){if(b.on("error",w),b._poolUseCount=(b._poolUseCount||0)+1,this.emit("release",$,b),$||this.ending||!b._queryable||b._ending||b._poolUseCount>=this.options.maxUses){if(b._poolUseCount>=this.options.maxUses)this.log("remove expended client");this._remove(b),this._pulseQueue();return}if(this._expired.has(b)){this.log("remove expired client"),this._expired.delete(b),this._remove(b),this._pulseQueue();return}let J;if(this.options.idleTimeoutMillis&&this._isAboveMin()){if(J=setTimeout(()=>{this.log("remove idle client"),this._remove(b)},this.options.idleTimeoutMillis),this.options.allowExitOnIdle)J.unref()}if(this.options.allowExitOnIdle)b.unref();this._idle.push(new E4(b,w,J)),this._pulseQueue()}query(b,w,$){if(typeof b==="function"){let J=N2(this.Promise,b);return setImmediate(function(){return J.callback(new Error("Passing a function as the first parameter to pool.query is not supported"))}),J.result}if(typeof w==="function")$=w,w=void 0;let U=N2(this.Promise,$);return $=U.callback,this.connect((J,W)=>{if(J)return $(J);let _=!1,X=(G)=>{if(_)return;_=!0,W.release(G),$(G)};W.once("error",X),this.log("dispatching query");try{W.query(b,w,(G,Q)=>{if(this.log("query dispatched"),W.removeListener("error",X),_)return;if(_=!0,W.release(G),G)return $(G);return $(void 0,Q)})}catch(G){return W.release(G),$(G)}}),U.result}end(b){if(this.log("ending"),this.ending){let $=new Error("Called end on pool more than once");return b?b($):this.Promise.reject($)}this.ending=!0;let w=N2(this.Promise,b);return this._endCallback=w.callback,this._pulseQueue(),w.result}get waitingCount(){return this._pendingQueue.length}get idleCount(){return this._idle.length}get expiredCount(){return this._clients.reduce((b,w)=>b+(this._expired.has(w)?1:0),0)}get totalCount(){return this._clients.length}}k4.exports=C4});var v4=M((cH,T4)=>{var I4=S("events").EventEmitter,yJ=S("util"),m5=z1(),L1=T4.exports=function(b,w,$){I4.call(this),b=m5.normalizeQueryConfig(b,w,$),this.text=b.text,this.values=b.values,this.name=b.name,this.queryMode=b.queryMode,this.callback=b.callback,this.state="new",this._arrayMode=b.rowMode==="array",this._emitRowEvents=!1,this.on("newListener",function(U){if(U==="row")this._emitRowEvents=!0}.bind(this))};yJ.inherits(L1,I4);var dJ={sqlState:"code",statementPosition:"position",messagePrimary:"message",context:"where",schemaName:"schema",tableName:"table",columnName:"column",dataTypeName:"dataType",constraintName:"constraint",sourceFile:"file",sourceLine:"line",sourceFunction:"routine"};L1.prototype.handleError=function(b){let w=this.native.pq.resultErrorFields();if(w)for(let $ in w){let U=dJ[$]||$;b[U]=w[$]}if(this.callback)this.callback(b);else this.emit("error",b);this.state="error"};L1.prototype.then=function(b,w){return this._getPromise().then(b,w)};L1.prototype.catch=function(b){return this._getPromise().catch(b)};L1.prototype._getPromise=function(){if(this._promise)return this._promise;return this._promise=new Promise(function(b,w){this._once("end",b),this._once("error",w)}.bind(this)),this._promise};L1.prototype.submit=function(b){this.state="running";let w=this;this.native=b.native,b.native.arrayMode=this._arrayMode;let $=function(U,J,W){if(b.native.arrayMode=!1,setImmediate(function(){w.emit("_done")}),U)return w.handleError(U);if(w._emitRowEvents)if(W.length>1)J.forEach((_,X)=>{_.forEach((G)=>{w.emit("row",G,W[X])})});else J.forEach(function(_){w.emit("row",_,W)});if(w.state="end",w.emit("end",W),w.callback)w.callback(null,W)};if(process.domain)$=process.domain.bind($);if(this.name){if(this.name.length>63)console.error("Warning! Postgres only supports 63 characters for query names."),console.error("You supplied %s (%s)",this.name,this.name.length),console.error("This can cause conflicts and silent errors executing queries");let U=(this.values||[]).map(m5.prepareValue);if(b.namedQueries[this.name]){if(this.text&&b.namedQueries[this.name]!==this.text){let J=new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);return $(J)}return b.native.execute(this.name,U,$)}return b.native.prepare(this.name,this.text,U.length,function(J){if(J)return $(J);return b.namedQueries[w.name]=w.text,w.native.execute(w.name,U,$)})}else if(this.values){if(!Array.isArray(this.values)){let J=new Error("Query values must be an array");return $(J)}let U=this.values.map(m5.prepareValue);b.native.query(this.text,U,$)}else if(this.queryMode==="extended")b.native.query(this.text,[],$);else b.native.query(this.text,$)}});var r5=M((LH,f4)=>{var l4;try{l4=(()=>{throw new Error("Cannot require module "+"pg-native");})()}catch(b){throw b}var aJ=H2(),h4=S("events").EventEmitter,uJ=S("util"),pJ=F5(),x4=v4(),i=f4.exports=function(b){h4.call(this),b=b||{},this._Promise=b.Promise||global.Promise,this._types=new aJ(b.types),this.native=new l4({types:this._types}),this._queryQueue=[],this._ending=!1,this._connecting=!1,this._connected=!1,this._queryable=!0;let w=this.connectionParameters=new pJ(b);if(b.nativeConnectionString)w.nativeConnectionString=b.nativeConnectionString;this.user=w.user,Object.defineProperty(this,"password",{configurable:!0,enumerable:!1,writable:!0,value:w.password}),this.database=w.database,this.host=w.host,this.port=w.port,this.namedQueries={}};i.Query=x4;uJ.inherits(i,h4);i.prototype._errorAllQueries=function(b){let w=($)=>{process.nextTick(()=>{$.native=this.native,$.handleError(b)})};if(this._hasActiveQuery())w(this._activeQuery),this._activeQuery=null;this._queryQueue.forEach(w),this._queryQueue.length=0};i.prototype._connect=function(b){let w=this;if(this._connecting){process.nextTick(()=>b(new Error("Client has already been connected. You cannot reuse a client.")));return}this._connecting=!0,this.connectionParameters.getLibpqConnectionString(function($,U){if(w.connectionParameters.nativeConnectionString)U=w.connectionParameters.nativeConnectionString;if($)return b($);w.native.connect(U,function(J){if(J)return w.native.end(),b(J);w._connected=!0,w.native.on("error",function(W){w._queryable=!1,w._errorAllQueries(W),w.emit("error",W)}),w.native.on("notification",function(W){w.emit("notification",{channel:W.relname,payload:W.extra})}),w.emit("connect"),w._pulseQueryQueue(!0),b()})})};i.prototype.connect=function(b){if(b){this._connect(b);return}return new this._Promise((w,$)=>{this._connect((U)=>{if(U)$(U);else w()})})};i.prototype.query=function(b,w,$){let U,J,W,_,X;if(b===null||b===void 0)throw new TypeError("Client was passed a null or undefined query");else if(typeof b.submit==="function"){if(W=b.query_timeout||this.connectionParameters.query_timeout,J=U=b,typeof w==="function")b.callback=w}else if(W=b.query_timeout||this.connectionParameters.query_timeout,U=new x4(b,w,$),!U.callback){let G,Q;J=new this._Promise((H,z)=>{G=H,Q=z}).catch((H)=>{throw Error.captureStackTrace(H),H}),U.callback=(H,z)=>H?Q(H):G(z)}if(W)X=U.callback,_=setTimeout(()=>{let G=new Error("Query read timeout");process.nextTick(()=>{U.handleError(G,this.connection)}),X(G),U.callback=()=>{};let Q=this._queryQueue.indexOf(U);if(Q>-1)this._queryQueue.splice(Q,1);this._pulseQueryQueue()},W),U.callback=(G,Q)=>{clearTimeout(_),X(G,Q)};if(!this._queryable)return U.native=this.native,process.nextTick(()=>{U.handleError(new Error("Client has encountered a connection error and is not queryable"))}),J;if(this._ending)return U.native=this.native,process.nextTick(()=>{U.handleError(new Error("Client was closed and is not queryable"))}),J;return this._queryQueue.push(U),this._pulseQueryQueue(),J};i.prototype.end=function(b){let w=this;if(this._ending=!0,!this._connected)this.once("connect",this.end.bind(this,b));let $;if(!b)$=new this._Promise(function(U,J){b=(W)=>W?J(W):U()});return this.native.end(function(){w._errorAllQueries(new Error("Connection terminated")),process.nextTick(()=>{if(w.emit("end"),b)b()})}),$};i.prototype._hasActiveQuery=function(){return this._activeQuery&&this._activeQuery.state!=="error"&&this._activeQuery.state!=="end"};i.prototype._pulseQueryQueue=function(b){if(!this._connected)return;if(this._hasActiveQuery())return;let w=this._queryQueue.shift();if(!w){if(!b)this.emit("drain");return}this._activeQuery=w,w.submit(this);let $=this;w.once("_done",function(){$._pulseQueryQueue()})};i.prototype.cancel=function(b){if(this._activeQuery===b)this.native.cancel(function(){});else if(this._queryQueue.indexOf(b)!==-1)this._queryQueue.splice(this._queryQueue.indexOf(b),1)};i.prototype.ref=function(){};i.prototype.unref=function(){};i.prototype.setTypeParser=function(b,w,$){return this._types.setTypeParser(b,w,$)};i.prototype.getTypeParser=function(b,w){return this._types.getTypeParser(b,w)}});var g5=M((VH,Z1)=>{var oJ=D4(),nJ=l1(),iJ=v5(),sJ=E5(),tJ=z1(),eJ=P4(),bW=H2(),{DatabaseError:wW}=T5(),{escapeIdentifier:$W,escapeLiteral:UW}=z1(),JW=(b)=>{return class w extends eJ{constructor($){super($,b)}}},y5=function(b){this.defaults=nJ,this.Client=b,this.Query=this.Client.Query,this.Pool=JW(this.Client),this._pools=[],this.Connection=iJ,this.types=v1(),this.DatabaseError=wW,this.TypeOverrides=bW,this.escapeIdentifier=$W,this.escapeLiteral=UW,this.Result=sJ,this.utils=tJ};if(typeof process.env.NODE_PG_FORCE_NATIVE!=="undefined")Z1.exports=new y5(r5());else Z1.exports=new y5(oJ),Object.defineProperty(Z1.exports,"native",{configurable:!0,enumerable:!1,get(){let b=null;try{b=new y5(r5())}catch(w){if(w.code!=="MODULE_NOT_FOUND")throw w}return Object.defineProperty(Z1.exports,"native",{value:b}),b}})});var g4=M((lH,WW)=>{WW.exports={name:"dotenv",version:"16.5.0",description:"Loads environment variables from .env file",main:"lib/main.js",types:"lib/main.d.ts",exports:{".":{types:"./lib/main.d.ts",require:"./lib/main.js",default:"./lib/main.js"},"./config":"./config.js","./config.js":"./config.js","./lib/env-options":"./lib/env-options.js","./lib/env-options.js":"./lib/env-options.js","./lib/cli-options":"./lib/cli-options.js","./lib/cli-options.js":"./lib/cli-options.js","./package.json":"./package.json"},scripts:{"dts-check":"tsc --project tests/types/tsconfig.json",lint:"standard",pretest:"npm run lint && npm run dts-check",test:"tap run --allow-empty-coverage --disable-coverage --timeout=60000","test:coverage":"tap run --show-full-coverage --timeout=60000 --coverage-report=lcov",prerelease:"npm test",release:"standard-version"},repository:{type:"git",url:"git://github.com/motdotla/dotenv.git"},homepage:"https://github.com/motdotla/dotenv#readme",funding:"https://dotenvx.com",keywords:["dotenv","env",".env","environment","variables","config","settings"],readmeFilename:"README.md",license:"BSD-2-Clause",devDependencies:{"@types/node":"^18.11.3",decache:"^4.6.2",sinon:"^14.0.1",standard:"^17.0.0","standard-version":"^9.5.0",tap:"^19.2.0",typescript:"^4.8.4"},engines:{node:">=12"},browser:{fs:!1}}});var a4=M((hH,B0)=>{var d5=S("fs"),a5=S("path"),_W=S("os"),XW=S("crypto"),GW=g4(),r4=GW.version,QW=/(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;function YW(b){let w={},$=b.toString();$=$.replace(/\r\n?/mg,`
`);let U;while((U=QW.exec($))!=null){let J=U[1],W=U[2]||"";W=W.trim();let _=W[0];if(W=W.replace(/^(['"`])([\s\S]*)\1$/mg,"$2"),_==='"')W=W.replace(/\\n/g,`
`),W=W.replace(/\\r/g,"\r");w[J]=W}return w}function HW(b){let w=d4(b),$=f.configDotenv({path:w});if(!$.parsed){let _=new Error(`MISSING_DATA: Cannot parse ${w} for an unknown reason`);throw _.code="MISSING_DATA",_}let U=y4(b).split(","),J=U.length,W;for(let _=0;_<J;_++)try{let X=U[_].trim(),G=qW($,X);W=f.decrypt(G.ciphertext,G.key);break}catch(X){if(_+1>=J)throw X}return f.parse(W)}function jW(b){console.log(`[dotenv@${r4}][WARN] ${b}`)}function g1(b){console.log(`[dotenv@${r4}][DEBUG] ${b}`)}function y4(b){if(b&&b.DOTENV_KEY&&b.DOTENV_KEY.length>0)return b.DOTENV_KEY;if(process.env.DOTENV_KEY&&process.env.DOTENV_KEY.length>0)return process.env.DOTENV_KEY;return""}function qW(b,w){let $;try{$=new URL(w)}catch(X){if(X.code==="ERR_INVALID_URL"){let G=new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");throw G.code="INVALID_DOTENV_KEY",G}throw X}let U=$.password;if(!U){let X=new Error("INVALID_DOTENV_KEY: Missing key part");throw X.code="INVALID_DOTENV_KEY",X}let J=$.searchParams.get("environment");if(!J){let X=new Error("INVALID_DOTENV_KEY: Missing environment part");throw X.code="INVALID_DOTENV_KEY",X}let W=`DOTENV_VAULT_${J.toUpperCase()}`,_=b.parsed[W];if(!_){let X=new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${W} in your .env.vault file.`);throw X.code="NOT_FOUND_DOTENV_ENVIRONMENT",X}return{ciphertext:_,key:U}}function d4(b){let w=null;if(b&&b.path&&b.path.length>0)if(Array.isArray(b.path)){for(let $ of b.path)if(d5.existsSync($))w=$.endsWith(".vault")?$:`${$}.vault`}else w=b.path.endsWith(".vault")?b.path:`${b.path}.vault`;else w=a5.resolve(process.cwd(),".env.vault");if(d5.existsSync(w))return w;return null}function m4(b){return b[0]==="~"?a5.join(_W.homedir(),b.slice(1)):b}function zW(b){if(Boolean(b&&b.debug))g1("Loading env from encrypted .env.vault");let $=f._parseVault(b),U=process.env;if(b&&b.processEnv!=null)U=b.processEnv;return f.populate(U,$,b),{parsed:$}}function RW(b){let w=a5.resolve(process.cwd(),".env"),$="utf8",U=Boolean(b&&b.debug);if(b&&b.encoding)$=b.encoding;else if(U)g1("No encoding is specified. UTF-8 is used by default");let J=[w];if(b&&b.path)if(!Array.isArray(b.path))J=[m4(b.path)];else{J=[];for(let G of b.path)J.push(m4(G))}let W,_={};for(let G of J)try{let Q=f.parse(d5.readFileSync(G,{encoding:$}));f.populate(_,Q,b)}catch(Q){if(U)g1(`Failed to load ${G} ${Q.message}`);W=Q}let X=process.env;if(b&&b.processEnv!=null)X=b.processEnv;if(f.populate(X,_,b),W)return{parsed:_,error:W};else return{parsed:_}}function MW(b){if(y4(b).length===0)return f.configDotenv(b);let w=d4(b);if(!w)return jW(`You set DOTENV_KEY but you are missing a .env.vault file at ${w}. Did you forget to build it?`),f.configDotenv(b);return f._configVault(b)}function NW(b,w){let $=Buffer.from(w.slice(-64),"hex"),U=Buffer.from(b,"base64"),J=U.subarray(0,12),W=U.subarray(-16);U=U.subarray(12,-16);try{let _=XW.createDecipheriv("aes-256-gcm",$,J);return _.setAuthTag(W),`${_.update(U)}${_.final()}`}catch(_){let X=_ instanceof RangeError,G=_.message==="Invalid key length",Q=_.message==="Unsupported state or unable to authenticate data";if(X||G){let H=new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");throw H.code="INVALID_DOTENV_KEY",H}else if(Q){let H=new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");throw H.code="DECRYPTION_FAILED",H}else throw _}}function AW(b,w,$={}){let U=Boolean($&&$.debug),J=Boolean($&&$.override);if(typeof w!=="object"){let W=new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");throw W.code="OBJECT_REQUIRED",W}for(let W of Object.keys(w))if(Object.prototype.hasOwnProperty.call(b,W)){if(J===!0)b[W]=w[W];if(U)if(J===!0)g1(`"${W}" is already defined and WAS overwritten`);else g1(`"${W}" is already defined and was NOT overwritten`)}else b[W]=w[W]}var f={configDotenv:RW,_configVault:zW,_parseVault:HW,config:MW,decrypt:NW,parse:YW,populate:AW};hH.configDotenv=f.configDotenv;hH._configVault=f._configVault;hH._parseVault=f._parseVault;hH.config=f.config;hH.decrypt=f.decrypt;hH.parse=f.parse;hH.populate=f.populate;B0.exports=f});var u4=M((OW)=>{OW.supports=function b(...w){let $=w.reduce((W,_)=>Object.assign(W,_),{}),U=$.implicitSnapshots||$.snapshots||!1,J=$.explicitSnapshots||!1;return Object.assign($,{implicitSnapshots:U,explicitSnapshots:J,snapshots:U,has:$.has||!1,permanence:$.permanence||!1,seek:$.seek||!1,createIfMissing:$.createIfMissing||!1,errorIfExists:$.errorIfExists||!1,deferredOpen:$.deferredOpen||!1,streams:$.streams||!1,encodings:Object.assign({},$.encodings),events:Object.assign({},$.events),additionalMethods:Object.assign({},$.additionalMethods),signals:Object.assign({},$.signals)})}});var W0=M((fH,p4)=>{p4.exports=class b extends Error{constructor(w,$){super(w||"");if(typeof $==="object"&&$!==null){if($.code)this.code=String($.code);if($.expected)this.expected=!0;if($.transient)this.transient=!0;if($.cause)this.cause=$.cause}if(Error.captureStackTrace)Error.captureStackTrace(this,this.constructor)}}});var p5=M((ZH,o4)=>{var u5=null;o4.exports=function(){if(u5===null)u5={textEncoder:new TextEncoder,textDecoder:new TextDecoder};return u5}});var n5=M((CW)=>{var o5=W0(),EW=new Set(["buffer","view","utf8"]);class n4{constructor(b){if(this.encode=b.encode||this.encode,this.decode=b.decode||this.decode,this.name=b.name||this.name,this.format=b.format||this.format,typeof this.encode!=="function")throw new TypeError("The 'encode' property must be a function");if(typeof this.decode!=="function")throw new TypeError("The 'decode' property must be a function");if(this.encode=this.encode.bind(this),this.decode=this.decode.bind(this),typeof this.name!=="string"||this.name==="")throw new TypeError("The 'name' property must be a string");if(typeof this.format!=="string"||!EW.has(this.format))throw new TypeError("The 'format' property must be one of 'buffer', 'view', 'utf8'");if(b.createViewTranscoder)this.createViewTranscoder=b.createViewTranscoder;if(b.createBufferTranscoder)this.createBufferTranscoder=b.createBufferTranscoder;if(b.createUTF8Transcoder)this.createUTF8Transcoder=b.createUTF8Transcoder}get commonName(){return this.name.split("+")[0]}createBufferTranscoder(){throw new o5(`Encoding '${this.name}' cannot be transcoded to 'buffer'`,{code:"LEVEL_ENCODING_NOT_SUPPORTED"})}createViewTranscoder(){throw new o5(`Encoding '${this.name}' cannot be transcoded to 'view'`,{code:"LEVEL_ENCODING_NOT_SUPPORTED"})}createUTF8Transcoder(){throw new o5(`Encoding '${this.name}' cannot be transcoded to 'utf8'`,{code:"LEVEL_ENCODING_NOT_SUPPORTED"})}}CW.Encoding=n4});var t5=M((IW)=>{var{Buffer:i5}=S("buffer")||{},{Encoding:s5}=n5(),PW=p5();class c2 extends s5{constructor(b){super({...b,format:"buffer"})}createViewTranscoder(){return new L2({encode:this.encode,decode:(b)=>this.decode(i5.from(b.buffer,b.byteOffset,b.byteLength)),name:`${this.name}+view`})}createBufferTranscoder(){return this}}class L2 extends s5{constructor(b){super({...b,format:"view"})}createBufferTranscoder(){return new c2({encode:(b)=>{let w=this.encode(b);return i5.from(w.buffer,w.byteOffset,w.byteLength)},decode:this.decode,name:`${this.name}+buffer`})}createViewTranscoder(){return this}}class i4 extends s5{constructor(b){super({...b,format:"utf8"})}createBufferTranscoder(){return new c2({encode:(b)=>i5.from(this.encode(b),"utf8"),decode:(b)=>this.decode(b.toString("utf8")),name:`${this.name}+buffer`})}createViewTranscoder(){let{textEncoder:b,textDecoder:w}=PW();return new L2({encode:($)=>b.encode(this.encode($)),decode:($)=>this.decode(w.decode($)),name:`${this.name}+view`})}createUTF8Transcoder(){return this}}IW.BufferFormat=c2;IW.ViewFormat=L2;IW.UTF8Format=i4});var b9=M((hW)=>{var{Buffer:u}=S("buffer")||{Buffer:{isBuffer:()=>!1}},{textEncoder:t4,textDecoder:s4}=p5()(),{BufferFormat:m1,ViewFormat:e5,UTF8Format:e4}=t5(),V2=(b)=>b;hW.utf8=new e4({encode:function(b){return u.isBuffer(b)?b.toString("utf8"):ArrayBuffer.isView(b)?s4.decode(b):String(b)},decode:V2,name:"utf8",createViewTranscoder(){return new e5({encode:function(b){return ArrayBuffer.isView(b)?b:t4.encode(b)},decode:function(b){return s4.decode(b)},name:`${this.name}+view`})},createBufferTranscoder(){return new m1({encode:function(b){return u.isBuffer(b)?b:ArrayBuffer.isView(b)?u.from(b.buffer,b.byteOffset,b.byteLength):u.from(String(b),"utf8")},decode:function(b){return b.toString("utf8")},name:`${this.name}+buffer`})}});hW.json=new e4({encode:JSON.stringify,decode:JSON.parse,name:"json"});hW.buffer=new m1({encode:function(b){return u.isBuffer(b)?b:ArrayBuffer.isView(b)?u.from(b.buffer,b.byteOffset,b.byteLength):u.from(String(b),"utf8")},decode:V2,name:"buffer",createViewTranscoder(){return new e5({encode:function(b){return ArrayBuffer.isView(b)?b:u.from(String(b),"utf8")},decode:function(b){return u.from(b.buffer,b.byteOffset,b.byteLength)},name:`${this.name}+view`})}});hW.view=new e5({encode:function(b){return ArrayBuffer.isView(b)?b:t4.encode(b)},decode:V2,name:"view",createBufferTranscoder(){return new m1({encode:function(b){return u.isBuffer(b)?b:ArrayBuffer.isView(b)?u.from(b.buffer,b.byteOffset,b.byteLength):u.from(String(b),"utf8")},decode:V2,name:`${this.name}+buffer`})}});hW.hex=new m1({encode:function(b){return u.isBuffer(b)?b:u.from(String(b),"hex")},decode:function(b){return b.toString("hex")},name:"hex"});hW.base64=new m1({encode:function(b){return u.isBuffer(b)?b:u.from(String(b),"base64")},decode:function(b){return b.toString("base64")},name:"base64"})});var U9=M((eW)=>{var w9=W0(),S2=b9(),{Encoding:yW}=n5(),{BufferFormat:dW,ViewFormat:aW,UTF8Format:uW}=t5(),r1=Symbol("formats"),B2=Symbol("encodings"),pW=new Set(["buffer","view","utf8"]);class $9{constructor(b){if(!Array.isArray(b))throw new TypeError("The first argument 'formats' must be an array");else if(!b.every((w)=>pW.has(w)))throw new TypeError("Format must be one of 'buffer', 'view', 'utf8'");this[B2]=new Map,this[r1]=new Set(b);for(let w in S2)try{this.encoding(w)}catch($){if($.code!=="LEVEL_ENCODING_NOT_SUPPORTED")throw $}}encodings(){return Array.from(new Set(this[B2].values()))}encoding(b){let w=this[B2].get(b);if(w===void 0){if(typeof b==="string"&&b!==""){if(w=sW[b],!w)throw new w9(`Encoding '${b}' is not found`,{code:"LEVEL_ENCODING_NOT_FOUND"})}else if(typeof b!=="object"||b===null)throw new TypeError("First argument 'encoding' must be a string or object");else w=oW(b);let{name:$,format:U}=w;if(!this[r1].has(U))if(this[r1].has("view"))w=w.createViewTranscoder();else if(this[r1].has("buffer"))w=w.createBufferTranscoder();else if(this[r1].has("utf8"))w=w.createUTF8Transcoder();else throw new w9(`Encoding '${$}' cannot be transcoded`,{code:"LEVEL_ENCODING_NOT_SUPPORTED"});for(let J of[b,$,w.name,w.commonName])this[B2].set(J,w)}return w}}eW.Transcoder=$9;function oW(b){if(b instanceof yW)return b;let w="type"in b&&typeof b.type==="string"?b.type:void 0,$=b.name||w||`anonymous-${tW++}`;switch(nW(b)){case"view":return new aW({...b,name:$});case"utf8":return new uW({...b,name:$});case"buffer":return new dW({...b,name:$});default:throw new TypeError("Format must be one of 'buffer', 'view', 'utf8'")}}function nW(b){if("format"in b&&b.format!==void 0)return b.format;else if("buffer"in b&&typeof b.buffer==="boolean")return b.buffer?"buffer":"utf8";else if("code"in b&&Number.isInteger(b.code))return"view";else return"buffer"}var iW={binary:S2.buffer,"utf-8":S2.utf8},sW={...S2,...iW},tW=0});var K2=M((dH,X9)=>{var J9=Symbol("kErrors");X9.exports=function(b){if(b=b.filter(w_),b.length===0)return;if(b.length===1)return b[0];return new _9(b)};class _9 extends Error{constructor(b){let w=new Set(b.map($_).filter(Boolean)),$=Array.from(w).join("; ");super($);W9(this,"name","CombinedError"),W9(this,J9,b),b3(this,"stack",()=>b.map(U_).join(`

`)),b3(this,"transient",()=>b.length>0&&b.every(J_)),b3(this,"expected",()=>b.length>0&&b.every(W_))}[Symbol.iterator](){return this[J9][Symbol.iterator]()}}function W9(b,w,$){Object.defineProperty(b,w,{value:$})}function b3(b,w,$){Object.defineProperty(b,w,{get:$})}function w_(b){return b!=null}function $_(b){return b.message}function U_(b){return b.stack}function J_(b){return b.transient===!0}function W_(b){return b.expected===!0}});var P0=M((X_)=>{var __=W0(),G9=new Set;X_.getOptions=function(b,w){if(typeof b==="object"&&b!==null)return b;if(w!==void 0)return w;return{}};X_.emptyOptions=Object.freeze({});X_.noop=function(){};X_.resolvedPromise=Promise.resolve();X_.deprecate=function(b){if(!G9.has(b)){G9.add(b);let w=globalThis.console;if(typeof w!=="undefined"&&typeof w.warn==="function")w.warn(new __(b,{code:"LEVEL_LEGACY"}))}}});var w3=M((z_)=>{var q_=W0();class Q9 extends q_{constructor(b){super("Operation has been aborted",{code:"LEVEL_ABORTED",cause:b})}get name(){return"AbortError"}}z_.AbortError=Q9});var T0=M((c_)=>{var y1=W0(),M_=K2(),{getOptions:$3,emptyOptions:U3,noop:N_}=P0(),{AbortError:A_}=w3(),O2=Symbol("decodeOne"),d1=Symbol("decodeMany"),I0=Symbol("keyEncoding"),y0=Symbol("valueEncoding");class a1{#b=!1;#w=null;#$=null;#W=0;#X;#U;#_;#J;constructor(b,w){if(typeof b!=="object"||b===null)throw new TypeError(`The first argument must be an abstract-level database, received ${b===null?"null":typeof b}`);if(typeof w!=="object"||w===null)throw new TypeError("The second argument must be an options object");this[I0]=w[I0],this[y0]=w[y0],this.#U=Number.isInteger(w.limit)&&w.limit>=0?w.limit:1/0,this.#X=w.signal!=null?w.signal:null,this.#J=w.snapshot!=null?w.snapshot:null,this.#_=!1,this.db=b,this.db.attachResource(this)}get count(){return this.#W}get limit(){return this.#U}async next(){this.#Q();try{if(this.#_||this.#W>=this.#U){this.#_=!0;return}let b=await this._next();if(b===void 0){this.#_=!0;return}try{b=this[O2](b)}catch(w){throw new D2(w)}return this.#W++,b}finally{this.#G()}}async _next(){}async nextv(b,w){if(!Number.isInteger(b))throw new TypeError("The first argument 'size' must be an integer");if(w=$3(w,U3),b<1)b=1;if(this.#U<1/0)b=Math.min(b,this.#U-this.#W);this.#Q();try{if(this.#_||b<=0)return this.#_=!0,[];let $=await this._nextv(b,w);if($.length===0)return this.#_=!0,$;try{this[d1]($)}catch(U){throw new D2(U)}return this.#W+=$.length,$}finally{this.#G()}}async _nextv(b,w){let $=[];while($.length<b){let U=await this._next(w);if(U!==void 0)$.push(U);else{this.#_=!0;break}}return $}async all(b){b=$3(b,U3),this.#Q();try{if(this.#_||this.#W>=this.#U)return[];let w=await this._all(b);try{this[d1](w)}catch($){throw new D2($)}return this.#W+=w.length,w}catch(w){this.#G(),await this.#j(w)}finally{if(this.#_=!0,this.#b)this.#G(),await this.close()}}async _all(b){let w=this.#W,$=[];while(!0){let U=this.#U<1/0?Math.min(1000,this.#U-w):1000;if(U<=0)return $;let J=await this._nextv(U,b);if(J.length===0)return $;$.push.apply($,J),w+=J.length}}seek(b,w){if(w=$3(w,U3),this.#$!==null);else if(this.#b)throw new y1("Iterator is busy: cannot call seek() until next() has completed",{code:"LEVEL_ITERATOR_BUSY"});else{let $=this.db.keyEncoding(w.keyEncoding||this[I0]),U=$.format;if(w.keyEncoding!==U)w={...w,keyEncoding:U};let J=this.db.prefixKey($.encode(b),U,!1);this._seek(J,w),this.#_=!1}}_seek(b,w){throw new y1("Iterator does not implement seek()",{code:"LEVEL_NOT_SUPPORTED"})}async close(){if(this.#$!==null)return this.#$.catch(N_);if(this.#$=new Promise((b,w)=>{this.#w=()=>{this.#w=null,this.#H().then(b,w)}}),!this.#b)this.#w();return this.#$}async _close(){}async*[Symbol.asyncIterator](){try{let b;while((b=await this.next())!==void 0)yield b}catch(b){await this.#j(b)}finally{await this.close()}}#Q(){if(this.#$!==null)throw new y1("Iterator is not open: cannot read after close()",{code:"LEVEL_ITERATOR_NOT_OPEN"});else if(this.#b)throw new y1("Iterator is busy: cannot read until previous read has completed",{code:"LEVEL_ITERATOR_BUSY"});else if(this.#X?.aborted)throw new A_;this.#J?.ref(),this.#b=!0}#G(){this.#b=!1,this.#w?.(),this.#J?.unref()}async#H(){await this._close(),this.db.detachResource(this)}async#j(b){try{await this.close()}catch(w){throw M_([b,w])}throw b}}if(typeof Symbol.asyncDispose==="symbol")a1.prototype[Symbol.asyncDispose]=async function(){return this.close()};class F2 extends a1{#b;#w;constructor(b,w){super(b,w);this.#b=w.keys!==!1,this.#w=w.values!==!1}[O2](b){let w=b[0],$=b[1];if(w!==void 0)b[0]=this.#b?this[I0].decode(w):void 0;if($!==void 0)b[1]=this.#w?this[y0].decode($):void 0;return b}[d1](b){let w=this[I0],$=this[y0];for(let U of b){let J=U[0],W=U[1];if(J!==void 0)U[0]=this.#b?w.decode(J):void 0;if(W!==void 0)U[1]=this.#w?$.decode(W):void 0}}}class Y9 extends a1{[O2](b){return this[I0].decode(b)}[d1](b){let w=this[I0];for(let $=0;$<b.length;$++){let U=b[$];if(U!==void 0)b[$]=w.decode(U)}}}class H9 extends a1{[O2](b){return this[y0].decode(b)}[d1](b){let w=this[y0];for(let $=0;$<b.length;$++){let U=b[$];if(U!==void 0)b[$]=w.decode(U)}}}class D2 extends y1{constructor(b){super("Iterator could not decode data",{code:"LEVEL_DECODE_ERROR",cause:b})}}F2.keyEncoding=I0;F2.valueEncoding=y0;c_.AbstractIterator=F2;c_.AbstractKeyIterator=Y9;c_.AbstractValueIterator=H9});var j9=M((D_)=>{var{AbstractKeyIterator:S_,AbstractValueIterator:K_}=T0(),d0=Symbol("iterator"),J3=Symbol("handleOne"),E2=Symbol("handleMany");class W3 extends S_{constructor(b,w){super(b,w);this[d0]=b.iterator({...w,keys:!0,values:!1})}[J3](b){return b[0]}[E2](b){for(let w=0;w<b.length;w++)b[w]=b[w][0]}}class _3 extends K_{constructor(b,w){super(b,w);this[d0]=b.iterator({...w,keys:!1,values:!0})}[J3](b){return b[1]}[E2](b){for(let w=0;w<b.length;w++)b[w]=b[w][1]}}for(let b of[W3,_3])b.prototype._next=async function(){let w=await this[d0].next();return w===void 0?w:this[J3](w)},b.prototype._nextv=async function(w,$){let U=await this[d0].nextv(w,$);return this[E2](U),U},b.prototype._all=async function(w){let $=await this[d0].all(w);return this[E2]($),$},b.prototype._seek=function(w,$){this[d0].seek(w,$)},b.prototype._close=async function(){return this[d0].close()};D_.DefaultKeyIterator=W3;D_.DefaultValueIterator=_3});var q9=M((P_)=>{var{AbstractIterator:E_,AbstractKeyIterator:C_,AbstractValueIterator:k_}=T0(),X3=W0(),s=Symbol("nut"),C2=Symbol("undefer"),k2=Symbol("factory"),R0=Symbol("signalOptions");class G3 extends E_{constructor(b,w){super(b,w);this[s]=null,this[k2]=()=>b.iterator(w),this[R0]={signal:w.signal},this.db.defer(()=>this[C2](),this[R0])}}class Q3 extends C_{constructor(b,w){super(b,w);this[s]=null,this[k2]=()=>b.keys(w),this[R0]={signal:w.signal},this.db.defer(()=>this[C2](),this[R0])}}class Y3 extends k_{constructor(b,w){super(b,w);this[s]=null,this[k2]=()=>b.values(w),this[R0]={signal:w.signal},this.db.defer(()=>this[C2](),this[R0])}}for(let b of[G3,Q3,Y3])b.prototype[C2]=function(){if(this.db.status==="open")this[s]=this[k2]()},b.prototype._next=async function(){if(this[s]!==null)return this[s].next();else if(this.db.status==="opening")return this.db.deferAsync(()=>this._next(),this[R0]);else throw new X3("Iterator is not open: cannot call next() after close()",{code:"LEVEL_ITERATOR_NOT_OPEN"})},b.prototype._nextv=async function(w,$){if(this[s]!==null)return this[s].nextv(w,$);else if(this.db.status==="opening")return this.db.deferAsync(()=>this._nextv(w,$),this[R0]);else throw new X3("Iterator is not open: cannot call nextv() after close()",{code:"LEVEL_ITERATOR_NOT_OPEN"})},b.prototype._all=async function(w){if(this[s]!==null)return this[s].all();else if(this.db.status==="opening")return this.db.deferAsync(()=>this._all(w),this[R0]);else throw new X3("Iterator is not open: cannot call all() after close()",{code:"LEVEL_ITERATOR_NOT_OPEN"})},b.prototype._seek=function(w,$){if(this[s]!==null)this[s]._seek(w,$);else if(this.db.status==="opening")this.db.defer(()=>this._seek(w,$),this[R0])},b.prototype._close=async function(){if(this[s]!==null)return this[s].close();else if(this.db.status==="opening")return this.db.deferAsync(()=>this._close())};P_.DeferredIterator=G3;P_.DeferredKeyIterator=Q3;P_.DeferredValueIterator=Y3});var P2=M((l_)=>{l_.prefixDescendantKey=function(b,w,$,U){while($!==null&&$!==U)b=$.prefixKey(b,w,!0),$=$.parent;return b};l_.isDescendant=function(b,w){while(!0){if(b.parent==null)return!1;if(b.parent===w)return!0;b=b.parent}}});var H3=M((g_)=>{var{prefixDescendantKey:f_,isDescendant:Z_}=P2();class z9{#b;#w;#$;constructor(b,w,$){this.#b=b,this.#w=w,this.#$=$}add(b){let w=b.type==="put",$=b.sublevel!=null,U=$?b.sublevel:this.#b;if(U._assertValidKey(b.key),b.keyEncoding=U.keyEncoding(b.keyEncoding),w)U._assertValidValue(b.value),b.valueEncoding=U.valueEncoding(b.valueEncoding);else if(b.type!=="del")throw new TypeError("A batch operation must have a type property that is 'put' or 'del'");let J=b.keyEncoding,W=J.encode(b.key),_=J.format,X=$&&!Z_(b.sublevel,this.#b)&&b.sublevel!==this.#b,G=$&&!X?f_(W,_,U,this.#b):W;if($&&!X)b.sublevel=null;let Q=null;if(this.#$!==null&&!X){if(Q={...b},Q.encodedKey=G,$)Q.key=G,Q.keyEncoding=this.#b.keyEncoding(_);this.#$.push(Q)}if(b.key=X?G:this.#b.prefixKey(G,_,!0),b.keyEncoding=_,w){let H=b.valueEncoding,z=H.encode(b.value),N=H.format;if(b.value=z,b.valueEncoding=N,Q!==null){if(Q.encodedValue=z,$)Q.value=z,Q.valueEncoding=this.#b.valueEncoding(N)}}return this.#w.push(b),this}}g_.PrewriteBatch=z9});var z3=M((u_)=>{var r_=K2(),I2=W0(),{getOptions:T2,emptyOptions:j3,noop:y_}=P0(),{prefixDescendantKey:R9,isDescendant:d_}=P2(),{PrewriteBatch:a_}=H3(),v2=Symbol("publicOperations"),u1=Symbol("privateOperations");class q3{#b="open";#w=0;#$=null;#W;#X;#U;#_;#J;constructor(b,w){if(typeof b!=="object"||b===null)throw new TypeError(`The first argument must be an abstract-level database, received ${b===null?"null":typeof b}`);let $=b.listenerCount("write")>0,U=!b.hooks.prewrite.noop;if(this.#W=$?[]:null,this.#J=T2(w,j3).add===!0,U){let J=new M9([],$?[]:null);this.#_=J,this.#U=new a_(b,J[u1],J[v2]),this.#X=b.hooks.prewrite.run}else this.#_=null,this.#U=null,this.#X=null;this.db=b,this.db.attachResource(this)}get length(){if(this.#_!==null)return this.#w+this.#_.length;else return this.#w}put(b,w,$){this.#Q(),$=T2($,j3);let U=$.sublevel!=null,J=U?$.sublevel:this.db;J._assertValidKey(b),J._assertValidValue(w);let W={...$,type:"put",key:b,value:w,keyEncoding:J.keyEncoding($.keyEncoding),valueEncoding:J.valueEncoding($.valueEncoding)};if(this.#X!==null)try{this.#X(W,this.#U),W.keyEncoding=J.keyEncoding(W.keyEncoding),W.valueEncoding=J.valueEncoding(W.valueEncoding)}catch(O){throw new I2("The prewrite hook failed on batch.put()",{code:"LEVEL_HOOK_ERROR",cause:O})}let _=W.keyEncoding,X=_.encode(W.key),G=_.format,Q=U&&!d_(W.sublevel,this.db)&&W.sublevel!==this.db,H=U&&!Q?R9(X,G,J,this.db):X,z=W.valueEncoding,N=z.encode(W.value),B=z.format;if(U&&!Q)W.sublevel=null;if(this.#W!==null&&!Q){let O={...W};if(O.encodedKey=H,O.encodedValue=N,U)O.key=H,O.value=N,O.keyEncoding=this.db.keyEncoding(G),O.valueEncoding=this.db.valueEncoding(B);this.#W.push(O)}if(W.key=Q?H:this.db.prefixKey(H,G,!0),W.value=N,W.keyEncoding=G,W.valueEncoding=B,this.#J)this._add(W);else this._put(W.key,N,W);return this.#w++,this}_put(b,w,$){}del(b,w){this.#Q(),w=T2(w,j3);let $=w.sublevel!=null,U=$?w.sublevel:this.db;U._assertValidKey(b);let J={...w,type:"del",key:b,keyEncoding:U.keyEncoding(w.keyEncoding)};if(this.#X!==null)try{this.#X(J,this.#U),J.keyEncoding=U.keyEncoding(J.keyEncoding)}catch(Q){throw new I2("The prewrite hook failed on batch.del()",{code:"LEVEL_HOOK_ERROR",cause:Q})}let W=J.keyEncoding,_=W.encode(J.key),X=W.format,G=$?R9(_,X,U,this.db):_;if($)J.sublevel=null;if(this.#W!==null){let Q={...J};if(Q.encodedKey=G,$)Q.key=G,Q.keyEncoding=this.db.keyEncoding(X);this.#W.push(Q)}if(J.key=this.db.prefixKey(G,X,!0),J.keyEncoding=X,this.#J)this._add(J);else this._del(J.key,J);return this.#w++,this}_del(b,w){}_add(b){}clear(){if(this.#Q(),this._clear(),this.#W!==null)this.#W=[];if(this.#_!==null)this.#_.clear();return this.#w=0,this}_clear(){}async write(b){if(this.#Q(),b=T2(b),this.#w===0)return this.close();else{this.#b="writing";let w=this.#G();try{if(this.#_!==null){let $=this.#_[v2],U=this.#_[u1],J=this.#_.length;for(let W=0;W<J;W++){let _=U[W];if(this.#J)this._add(_);else if(_.type==="put")this._put(_.key,_.value,_);else this._del(_.key,_)}if($!==null&&J!==0)this.#W=this.#W.concat($)}await this._write(b)}catch($){w();try{await this.#$}catch(U){$=r_([$,U])}throw $}if(w(),this.#W!==null)this.db.emit("write",this.#W);return this.#$}}async _write(b){}async close(){if(this.#$!==null)return this.#$.catch(y_);else return this.#G()(),this.#$}async _close(){}#Q(){if(this.#b!=="open")throw new I2("Batch is not open: cannot change operations after write() or close()",{code:"LEVEL_BATCH_NOT_OPEN"});if(this.db.status!=="open")throw new I2("Database is not open",{code:"LEVEL_DATABASE_NOT_OPEN"})}#G(){let b;return this.#$=new Promise((w,$)=>{b=()=>{this.#H().then(w,$)}}),b}async#H(){this.#b="closing",await this._close(),this.db.detachResource(this)}}if(typeof Symbol.asyncDispose==="symbol")q3.prototype[Symbol.asyncDispose]=async function(){return this.close()};class M9{constructor(b,w){this[u1]=b,this[v2]=w}get length(){return this[u1].length}clear(){for(let b of[v2,u1]){let w=this[b];if(w!==null)w.splice(0,w.length)}}}u_.AbstractChainedBatch=q3});var A9=M((n_)=>{var{AbstractChainedBatch:o_}=z3();class N9 extends o_{#b=[];constructor(b){super(b,{add:!0})}_add(b){this.#b.push(b)}_clear(){this.#b=[]}async _write(b){return this.db._batch(this.#b,b)}}n_.DefaultChainedBatch=N9});var V9=M((t_)=>{var{noop:s_}=P0();class L9{constructor(){this.postopen=new l2({async:!0}),this.prewrite=new l2({async:!1}),this.newsub=new l2({async:!1})}}class l2{#b=new Set;#w;constructor(b){this.#w=b.async,this.noop=!0,this.run=this.#$()}add(b){c9(b),this.#b.add(b),this.noop=!1,this.run=this.#$()}delete(b){c9(b),this.#b.delete(b),this.noop=this.#b.size===0,this.run=this.#$()}#$(){if(this.noop)return s_;else if(this.#b.size===1){let[b]=this.#b;return b}else if(this.#w)return async function(w,...$){for(let U of w)await U(...$)}.bind(null,Array.from(this.#b));else return function(w,...$){for(let U of w)U(...$)}.bind(null,Array.from(this.#b))}}var c9=function(b){if(typeof b!=="function")throw new TypeError(`The first argument must be a function, received ${b===null?"null":typeof b}`)};t_.DatabaseHooks=L9});var B9=M((wX)=>{var{deprecate:bX}=P0();wX.EventMonitor=class b{constructor(w){this.write=!1;let $=(J)=>{if(J==="write")this.write=!0;if(J==="put"||J==="del"||J==="batch")bX(`The '${J}' event has been removed in favor of 'write'`)},U=(J)=>{if(J==="write")this.write=w.listenerCount("write")>0};w.on("newListener",$),w.on("removeListener",U)}}});var D9=M((WX)=>{var{getOptions:UX,emptyOptions:JX}=P0(),{AbortError:S9}=w3();class R3{constructor(b,w){this.fn=b,this.signal=w}}class K9{#b;#w;constructor(){this.#b=[],this.#w=new Set}add(b,w){w=UX(w,JX);let $=w.signal;if($==null){this.#b.push(new R3(b,null));return}if($.aborted){b(new S9);return}if(!this.#w.has($))this.#w.add($),$.addEventListener("abort",this.#$,{once:!0});this.#b.push(new R3(b,$))}drain(){let b=this.#b,w=this.#w;this.#b=[],this.#w=new Set;for(let $ of w)$.removeEventListener("abort",this.#$);for(let $ of b)$.fn.call(null)}#$=(b)=>{let w=b.target,$=new S9,U=[];this.#b=this.#b.filter(function(J){if(J.signal!==null&&J.signal===w)return U.push(J),!1;else return!0}),this.#w.delete(w);for(let J of U)J.fn.call(null,$)}}WX.DeferredQueue=K9});var F9=M((Uj,O9)=>{var XX=Object.prototype.hasOwnProperty,GX=new Set(["lt","lte","gt","gte"]);O9.exports=function(b,w){let $={};for(let U in b){if(!XX.call(b,U))continue;if(U==="keyEncoding"||U==="valueEncoding")continue;if(GX.has(U))$[U]=w.encode(b[U]);else $[U]=b[U]}return $.reverse=!!$.reverse,$.limit=Number.isInteger($.limit)&&$.limit>=0?$.limit:-1,$}});var P9=M((jX)=>{var{AbstractIterator:QX,AbstractKeyIterator:YX,AbstractValueIterator:HX}=T0();class E9 extends QX{#b;#w;constructor(b,w,$,U){super(b,w);this.#b=$,this.#w=U}async _next(){let b=await this.#b.next();if(b!==void 0){let w=b[0];if(w!==void 0)b[0]=this.#w(w)}return b}async _nextv(b,w){let $=await this.#b.nextv(b,w),U=this.#w;for(let J of $){let W=J[0];if(W!==void 0)J[0]=U(W)}return $}async _all(b){let w=await this.#b.all(b),$=this.#w;for(let U of w){let J=U[0];if(J!==void 0)U[0]=$(J)}return w}_seek(b,w){this.#b.seek(b,w)}async _close(){return this.#b.close()}}class C9 extends YX{#b;#w;constructor(b,w,$,U){super(b,w);this.#b=$,this.#w=U}async _next(){let b=await this.#b.next();return b===void 0?b:this.#w(b)}async _nextv(b,w){let $=await this.#b.nextv(b,w),U=this.#w;for(let J=0;J<$.length;J++){let W=$[J];if(W!==void 0)$[J]=U(W)}return $}async _all(b){let w=await this.#b.all(b),$=this.#w;for(let U=0;U<w.length;U++){let J=w[U];if(J!==void 0)w[U]=$(J)}return w}_seek(b,w){this.#b.seek(b,w)}async _close(){return this.#b.close()}}class k9 extends HX{#b;constructor(b,w,$){super(b,w);this.#b=$}async _next(){return this.#b.next()}async _nextv(b,w){return this.#b.nextv(b,w)}async _all(b){return this.#b.all(b)}_seek(b,w){this.#b.seek(b,w)}async _close(){return this.#b.close()}}jX.AbstractSublevelIterator=E9;jX.AbstractSublevelKeyIterator=C9;jX.AbstractSublevelValueIterator=k9});var l9=M((Wj,v9)=>{var MX=W0(),{Buffer:N3}=S("buffer")||{},{AbstractSublevelIterator:NX,AbstractSublevelKeyIterator:AX,AbstractSublevelValueIterator:cX}=P9(),v0=Symbol("root"),I9=new TextEncoder,LX={separator:"!"};v9.exports=function({AbstractLevel:b}){class w extends b{#b;#w;#$;#W;#X;#U;#_;static defaults($){if($==null)return LX;else if(!$.separator)return{...$,separator:"!"};else return $}constructor($,U,J){let{separator:W,manifest:_,...X}=w.defaults(J),G=[].concat(U).map((O)=>BX(O,W)),Q=W.charCodeAt(0)+1,H=$[v0]||$;if(!G.every((O)=>I9.encode(O).every((P)=>P>Q&&P<127)))throw new MX(`Sublevel name must use bytes > ${Q} < 127`,{code:"LEVEL_INVALID_PREFIX"});super(VX($,_),X);let z=G.map((O)=>W+O+W).join(""),N=($.prefix||"")+z,B=N.slice(0,-1)+String.fromCharCode(Q);this[v0]=H,this.#U=$,this.#$=G,this.#W=$.prefix?$.path().concat(G):G,this.#b=new h2(N),this.#X=new h2(B),this.#w=new h2(z),this.#_=new T9}prefixKey($,U,J){let W=J?this.#w:this.#b;if(U==="utf8")return W.utf8+$;else if($.byteLength===0)return W[U];else if(U==="view"){let _=W.view,X=new Uint8Array(_.byteLength+$.byteLength);return X.set(_,0),X.set($,_.byteLength),X}else{let _=W.buffer;return N3.concat([_,$],_.byteLength+$.byteLength)}}#J($,U){if($.gte!==void 0)$.gte=this.prefixKey($.gte,U,!1);else if($.gt!==void 0)$.gt=this.prefixKey($.gt,U,!1);else $.gte=this.#b[U];if($.lte!==void 0)$.lte=this.prefixKey($.lte,U,!1);else if($.lt!==void 0)$.lt=this.prefixKey($.lt,U,!1);else $.lte=this.#X[U]}get prefix(){return this.#b.utf8}get db(){return this[v0]}get parent(){return this.#U}path($=!1){return $?this.#$:this.#W}async _open($){await this.#U.open({passive:!0}),this.#U.attachResource(this)}async _close(){this.#U.detachResource(this)}async _put($,U,J){return this.#U.put($,U,J)}async _get($,U){return this.#U.get($,U)}_getSync($,U){return this.#U.getSync($,U)}async _getMany($,U){return this.#U.getMany($,U)}async _has($,U){return this.#U.has($,U)}async _hasMany($,U){return this.#U.hasMany($,U)}async _del($,U){return this.#U.del($,U)}async _batch($,U){return this.#U.batch($,U)}async _clear($){return this.#J($,$.keyEncoding),this[v0].clear($)}_iterator($){this.#J($,$.keyEncoding);let U=this[v0].iterator($),J=this.#_.get(this.#b.utf8.length,$.keyEncoding);return new NX(this,$,U,J)}_keys($){this.#J($,$.keyEncoding);let U=this[v0].keys($),J=this.#_.get(this.#b.utf8.length,$.keyEncoding);return new AX(this,$,U,J)}_values($){this.#J($,$.keyEncoding);let U=this[v0].values($);return new cX(this,$,U)}_snapshot($){return this[v0].snapshot($)}}return{AbstractSublevel:w}};var VX=function(b,w){return{...b.supports,createIfMissing:!1,errorIfExists:!1,events:{},additionalMethods:{},...w,encodings:{utf8:M3(b,"utf8"),buffer:M3(b,"buffer"),view:M3(b,"view")}}},M3=function(b,w){return b.supports.encodings[w]?b.keyEncoding(w).name===w:!1};class h2{constructor(b){this.utf8=b,this.view=I9.encode(b),this.buffer=N3?N3.from(this.view.buffer,0,this.view.byteLength):{}}}class T9{constructor(){this.cache=new Map}get(b,w){let $=this.cache.get(w);if($===void 0){if(w==="view")$=function(U,J){return J.subarray(U)}.bind(null,b);else $=function(U,J){return J.slice(U)}.bind(null,b);this.cache.set(w,$)}return $}}var BX=function(b,w){let $=0,U=b.length;while($<U&&b[$]===w)$++;while(U>$&&b[U-1]===w)U--;return b.slice($,U)}});var B3=M((mX)=>{var{supports:SX}=u4(),{Transcoder:KX}=U9(),{EventEmitter:DX}=S("events"),m=W0(),A3=K2(),{AbstractIterator:a0}=T0(),{DefaultKeyIterator:OX,DefaultValueIterator:FX}=j9(),{DeferredIterator:EX,DeferredKeyIterator:CX,DeferredValueIterator:kX}=q9(),{DefaultChainedBatch:PX}=A9(),{DatabaseHooks:IX}=V9(),{PrewriteBatch:TX}=H3(),{EventMonitor:vX}=B9(),{getOptions:M0,noop:c3,emptyOptions:lX,resolvedPromise:h9}=P0(),{prefixDescendantKey:hX,isDescendant:xX}=P2(),{DeferredQueue:fX}=D9(),x2=F9();class Z2 extends DX{#b="opening";#w=!0;#$=null;#W=!1;#X;#U;#_;#J;#Q;#G;#H;#j;constructor(b,w){super();if(typeof b!=="object"||b===null)throw new TypeError("The first argument 'manifest' must be an object");w=M0(w);let{keyEncoding:$,valueEncoding:U,passive:J,...W}=w;this.#X=new Set,this.#U=new fX,this.#_=W;let _=b.snapshots!==!1&&b.implicitSnapshots!==!1;this.hooks=new IX,this.supports=SX(b,{deferredOpen:!0,seek:!0,implicitSnapshots:_,permanence:b.permanence!==!1,encodings:b.encodings||{},events:{...b.events,opening:!0,open:!0,closing:!0,closed:!0,write:!0,clear:!0}}),this.#j=new vX(this),this.#Q=new KX(ZX(this)),this.#G=this.#Q.encoding($||"utf8"),this.#H=this.#Q.encoding(U||"utf8");for(let X of this.#Q.encodings())if(!this.supports.encodings[X.commonName])this.supports.encodings[X.commonName]=!0;this.#J={empty:lX,entry:Object.freeze({keyEncoding:this.#G.commonName,valueEncoding:this.#H.commonName}),entryFormat:Object.freeze({keyEncoding:this.#G.format,valueEncoding:this.#H.format}),key:Object.freeze({keyEncoding:this.#G.commonName}),keyFormat:Object.freeze({keyEncoding:this.#G.format}),owner:Object.freeze({owner:this})},queueMicrotask(()=>{if(this.#w)this.open({passive:!1}).catch(c3)})}get status(){return this.#b}get parent(){return null}keyEncoding(b){return this.#Q.encoding(b??this.#G)}valueEncoding(b){return this.#Q.encoding(b??this.#H)}async open(b){b={...this.#_,...M0(b)},b.createIfMissing=b.createIfMissing!==!1,b.errorIfExists=!!b.errorIfExists;let w=this.hooks.postopen.noop?null:this.hooks.postopen.run,$=b.passive;if($&&this.#w)await void 0;this.#q();while(this.#$!==null)await this.#$.catch(c3);if(this.#q(),$){if(this.#b!=="open")throw new f2}else if(this.#b==="closed"||this.#w){this.#w=!1,this.#$=h9,this.#$=(async()=>{this.#b="opening";try{this.emit("opening"),await this._open(b)}catch(U){this.#b="closed",this.#U.drain();try{await this.#z()}catch(J){U=A3([U,J])}throw new f2(U)}if(this.#b="open",w!==null){let U;try{this.#W=!0,await w(b)}catch(J){U=x9(J)}finally{this.#W=!1}if(U){this.#b="closing",this.#U.drain();try{await this.#z(),await this._close()}catch(J){this.#W=!0,U=A3([U,J])}throw this.#b="closed",new m("The postopen hook failed on open()",{code:"LEVEL_HOOK_ERROR",cause:U})}}this.#U.drain(),this.emit("open")})();try{await this.#$}finally{this.#$=null}}else if(this.#b!=="open")throw new f2}async _open(b){}async close(){this.#q();while(this.#$!==null)await this.#$.catch(c3);if(this.#q(),this.#b==="open"||this.#w){let b=this.#w;this.#w=!1,this.#$=h9,this.#$=(async()=>{this.#b="closing",this.#U.drain();try{if(this.emit("closing"),await this.#z(),!b)await this._close()}catch(w){throw this.#b="open",this.#U.drain(),new V3(w)}this.#b="closed",this.#U.drain(),this.emit("closed")})();try{await this.#$}finally{this.#$=null}}else if(this.#b!=="closed")throw new V3}async#z(){if(this.#X.size===0)return;let b=Array.from(this.#X),w=b.map(gX),$=await Promise.allSettled(w),U=[];for(let J=0;J<$.length;J++)if($[J].status==="fulfilled")this.#X.delete(b[J]);else U.push(x9($[J].reason));if(U.length>0)throw A3(U)}async _close(){}async get(b,w){if(w=M0(w,this.#J.entry),this.#b==="opening")return this.deferAsync(()=>this.get(b,w));this.#Y(),this._assertValidKey(b);let $=w.snapshot,U=this.keyEncoding(w.keyEncoding),J=this.valueEncoding(w.valueEncoding),W=U.format,_=J.format;if(w===this.#J.entry)w=this.#J.entryFormat;else if(w.keyEncoding!==W||w.valueEncoding!==_)w={...w,keyEncoding:W,valueEncoding:_};let X=U.encode(b),G=this.prefixKey(X,W,!0);$?.ref();let Q;try{Q=await this._get(G,w)}finally{$?.unref()}try{return Q===void 0?Q:J.decode(Q)}catch(H){throw new m("Could not decode value",{code:"LEVEL_DECODE_ERROR",cause:H})}}async _get(b,w){return}getSync(b,w){if(this.status!=="open")throw new m("Database is not open",{code:"LEVEL_DATABASE_NOT_OPEN"});if(this._assertValidKey(b),w==null){let H=this.#G.encode(b),z=this.prefixKey(H,this.#G.format,!0),N=this._getSync(z,this.#J.entryFormat);try{return N!==void 0?this.#H.decode(N):void 0}catch(B){throw new m("Could not decode value",{code:"LEVEL_DECODE_ERROR",cause:B})}}let $=w.snapshot,U=this.keyEncoding(w.keyEncoding),J=this.valueEncoding(w.valueEncoding),W=U.format,_=J.format;if(w.keyEncoding!==W||w.valueEncoding!==_)w={...w,keyEncoding:W,valueEncoding:_};let X=U.encode(b),G=this.prefixKey(X,W,!0),Q;$?.ref();try{Q=this._getSync(G,w)}finally{$?.unref()}try{return Q!==void 0?J.decode(Q):void 0}catch(H){throw new m("Could not decode value",{code:"LEVEL_DECODE_ERROR",cause:H})}}_getSync(b,w){throw new m("Database does not support getSync()",{code:"LEVEL_NOT_SUPPORTED"})}async getMany(b,w){if(w=M0(w,this.#J.entry),this.#b==="opening")return this.deferAsync(()=>this.getMany(b,w));if(this.#Y(),!Array.isArray(b))throw new TypeError("The first argument 'keys' must be an array");if(b.length===0)return[];let $=w.snapshot,U=this.keyEncoding(w.keyEncoding),J=this.valueEncoding(w.valueEncoding),W=U.format,_=J.format;if(w===this.#J.entry)w=this.#J.entryFormat;else if(w.keyEncoding!==W||w.valueEncoding!==_)w={...w,keyEncoding:W,valueEncoding:_};let X=new Array(b.length);for(let Q=0;Q<b.length;Q++){let H=b[Q];this._assertValidKey(H),X[Q]=this.prefixKey(U.encode(H),W,!0)}$?.ref();let G;try{G=await this._getMany(X,w)}finally{$?.unref()}try{for(let Q=0;Q<G.length;Q++)if(G[Q]!==void 0)G[Q]=J.decode(G[Q])}catch(Q){throw new m(`Could not decode one or more of ${G.length} value(s)`,{code:"LEVEL_DECODE_ERROR",cause:Q})}return G}async _getMany(b,w){return new Array(b.length).fill(void 0)}async has(b,w){if(w=M0(w,this.#J.key),this.#b==="opening")return this.deferAsync(()=>this.has(b,w));this.#Y(),this._assertValidKey(b);let $=w.snapshot,U=this.keyEncoding(w.keyEncoding),J=U.format;if(w===this.#J.key)w=this.#J.keyFormat;else if(w.keyEncoding!==J)w={...w,keyEncoding:J};let W=U.encode(b),_=this.prefixKey(W,J,!0);$?.ref();try{return this._has(_,w)}finally{$?.unref()}}async _has(b,w){throw new m("Database does not support has()",{code:"LEVEL_NOT_SUPPORTED"})}async hasMany(b,w){if(w=M0(w,this.#J.key),this.#b==="opening")return this.deferAsync(()=>this.hasMany(b,w));if(this.#Y(),!Array.isArray(b))throw new TypeError("The first argument 'keys' must be an array");if(b.length===0)return[];let $=w.snapshot,U=this.keyEncoding(w.keyEncoding),J=U.format;if(w===this.#J.key)w=this.#J.keyFormat;else if(w.keyEncoding!==J)w={...w,keyEncoding:J};let W=new Array(b.length);for(let _=0;_<b.length;_++){let X=b[_];this._assertValidKey(X),W[_]=this.prefixKey(U.encode(X),J,!0)}$?.ref();try{return this._hasMany(W,w)}finally{$?.unref()}}async _hasMany(b,w){throw new m("Database does not support hasMany()",{code:"LEVEL_NOT_SUPPORTED"})}async put(b,w,$){if(!this.hooks.prewrite.noop)return this.batch([{type:"put",key:b,value:w}],$);if($=M0($,this.#J.entry),this.#b==="opening")return this.deferAsync(()=>this.put(b,w,$));this.#Y(),this._assertValidKey(b),this._assertValidValue(w);let U=this.keyEncoding($.keyEncoding),J=this.valueEncoding($.valueEncoding),W=U.format,_=J.format,X=this.#j.write,G=$;if($===this.#J.entry)$=this.#J.entryFormat;else if($.keyEncoding!==W||$.valueEncoding!==_)$={...$,keyEncoding:W,valueEncoding:_};let Q=U.encode(b),H=this.prefixKey(Q,W,!0),z=J.encode(w);if(await this._put(H,z,$),X){let N={...G,type:"put",key:b,value:w,keyEncoding:U,valueEncoding:J,encodedKey:Q,encodedValue:z};this.emit("write",[N])}}async _put(b,w,$){}async del(b,w){if(!this.hooks.prewrite.noop)return this.batch([{type:"del",key:b}],w);if(w=M0(w,this.#J.key),this.#b==="opening")return this.deferAsync(()=>this.del(b,w));this.#Y(),this._assertValidKey(b);let $=this.keyEncoding(w.keyEncoding),U=$.format,J=this.#j.write,W=w;if(w===this.#J.key)w=this.#J.keyFormat;else if(w.keyEncoding!==U)w={...w,keyEncoding:U};let _=$.encode(b),X=this.prefixKey(_,U,!0);if(await this._del(X,w),J){let G={...W,type:"del",key:b,keyEncoding:$,encodedKey:_};this.emit("write",[G])}}async _del(b,w){}batch(b,w){if(!arguments.length)return this.#Y(),this._chainedBatch();return w=M0(w,this.#J.empty),this.#R(b,w)}async#R(b,w){if(this.#b==="opening")return this.deferAsync(()=>this.#R(b,w));if(this.#Y(),!Array.isArray(b))throw new TypeError("The first argument 'operations' must be an array");if(b.length===0)return;let $=b.length,U=!this.hooks.prewrite.noop,J=this.#j.write,W=J?new Array($):null,_=new Array($),X=U?new TX(this,_,W):null;for(let G=0;G<$;G++){let Q={...w,...b[G]},H=Q.type==="put",z=Q.sublevel!=null,N=z?Q.sublevel:this;if(N._assertValidKey(Q.key),Q.keyEncoding=N.keyEncoding(Q.keyEncoding),H)N._assertValidValue(Q.value),Q.valueEncoding=N.valueEncoding(Q.valueEncoding);else if(Q.type!=="del")throw new TypeError("A batch operation must have a type property that is 'put' or 'del'");if(U)try{if(this.hooks.prewrite.run(Q,X),Q.keyEncoding=N.keyEncoding(Q.keyEncoding),H)Q.valueEncoding=N.valueEncoding(Q.valueEncoding)}catch(K){throw new m("The prewrite hook failed on batch()",{code:"LEVEL_HOOK_ERROR",cause:K})}let B=Q.keyEncoding,O=B.encode(Q.key),P=B.format,x=z&&!xX(Q.sublevel,this)&&Q.sublevel!==this,Z=z&&!x?hX(O,P,N,this):O;if(z&&!x)Q.sublevel=null;let L=null;if(J&&!x){if(L={...Q},L.encodedKey=Z,z)L.key=Z,L.keyEncoding=this.keyEncoding(P);W[G]=L}if(Q.key=x?Z:this.prefixKey(Z,P,!0),Q.keyEncoding=P,H){let K=Q.valueEncoding,C=K.encode(Q.value),d=K.format;if(Q.value=C,Q.valueEncoding=d,J&&!x){if(L.encodedValue=C,z)L.value=C,L.valueEncoding=this.valueEncoding(d)}}_[G]=Q}if(await this._batch(_,w),J)this.emit("write",W)}async _batch(b,w){}sublevel(b,w){let $=L3.defaults(w),U=this._sublevel(b,$);if(!this.hooks.newsub.noop)try{this.hooks.newsub.run(U,$)}catch(J){throw new m("The newsub hook failed on sublevel()",{code:"LEVEL_HOOK_ERROR",cause:J})}return U}_sublevel(b,w){return new L3(this,b,w)}prefixKey(b,w,$){return b}async clear(b){if(b=M0(b,this.#J.empty),this.#b==="opening")return this.deferAsync(()=>this.clear(b));this.#Y();let w=b,$=this.keyEncoding(b.keyEncoding),U=b.snapshot;if(b=x2(b,$),b.keyEncoding=$.format,b.limit!==0){U?.ref();try{await this._clear(b)}finally{U?.unref()}this.emit("clear",w)}}async _clear(b){}iterator(b){let w=this.keyEncoding(b?.keyEncoding),$=this.valueEncoding(b?.valueEncoding);if(b=x2(b,w),b.keys=b.keys!==!1,b.values=b.values!==!1,b[a0.keyEncoding]=w,b[a0.valueEncoding]=$,b.keyEncoding=w.format,b.valueEncoding=$.format,this.#b==="opening")return new EX(this,b);return this.#Y(),this._iterator(b)}_iterator(b){return new a0(this,b)}keys(b){let w=this.keyEncoding(b?.keyEncoding),$=this.valueEncoding(b?.valueEncoding);if(b=x2(b,w),b[a0.keyEncoding]=w,b[a0.valueEncoding]=$,b.keyEncoding=w.format,b.valueEncoding=$.format,this.#b==="opening")return new CX(this,b);return this.#Y(),this._keys(b)}_keys(b){return new OX(this,b)}values(b){let w=this.keyEncoding(b?.keyEncoding),$=this.valueEncoding(b?.valueEncoding);if(b=x2(b,w),b[a0.keyEncoding]=w,b[a0.valueEncoding]=$,b.keyEncoding=w.format,b.valueEncoding=$.format,this.#b==="opening")return new kX(this,b);return this.#Y(),this._values(b)}_values(b){return new FX(this,b)}snapshot(b){if(this.#Y(),typeof b!=="object"||b===null)b=this.#J.owner;else if(b.owner==null)b={...b,owner:this};return this._snapshot(b)}_snapshot(b){throw new m("Database does not support explicit snapshots",{code:"LEVEL_NOT_SUPPORTED"})}defer(b,w){if(typeof b!=="function")throw new TypeError("The first argument must be a function");this.#U.add(function($){if(!$)b()},w)}deferAsync(b,w){if(typeof b!=="function")throw new TypeError("The first argument must be a function");return new Promise(($,U)=>{this.#U.add(function(J){if(J)U(J);else b().then($,U)},w)})}attachResource(b){if(typeof b!=="object"||b===null||typeof b.close!=="function")throw new TypeError("The first argument must be a resource object");this.#X.add(b)}detachResource(b){this.#X.delete(b)}_chainedBatch(){return new PX(this)}_assertValidKey(b){if(b===null||b===void 0)throw new m("Key cannot be null or undefined",{code:"LEVEL_INVALID_KEY"})}_assertValidValue(b){if(b===null||b===void 0)throw new m("Value cannot be null or undefined",{code:"LEVEL_INVALID_VALUE"})}#Y(){if(this.#b!=="open")throw new m("Database is not open",{code:"LEVEL_DATABASE_NOT_OPEN"})}#q(){if(this.#W)throw new m("Database status is locked",{code:"LEVEL_STATUS_LOCKED"})}}var{AbstractSublevel:L3}=l9()({AbstractLevel:Z2});mX.AbstractLevel=Z2;mX.AbstractSublevel=L3;if(typeof Symbol.asyncDispose==="symbol")Z2.prototype[Symbol.asyncDispose]=async function(){return this.close()};var ZX=function(b){return Object.keys(b.supports.encodings).filter((w)=>!!b.supports.encodings[w])},gX=function(b){return b.close()},x9=function(b){if(b instanceof Error)return b;if(Object.prototype.toString.call(b)==="[object Error]")return b;return new TypeError(`Promise rejection reason must be an Error, received ${b===null?"null":typeof b}`)};class f2 extends m{constructor(b){super("Database failed to open",{code:"LEVEL_DATABASE_NOT_OPEN",cause:b})}}class V3 extends m{constructor(b){super("Database failed to close",{code:"LEVEL_DATABASE_NOT_CLOSED",cause:b})}}});var f9=M((pX)=>{var dX=W0(),{noop:aX}=P0();class S3{#b=!0;#w=0;#$=null;#W=null;#X;constructor(b){let w=b.owner;if(typeof w!=="object"||w===null)throw new TypeError(`Owner must be an abstract-level database, received ${w===null?"null":typeof w}`);this.#X=w,this.#X.attachResource(this)}ref(){if(!this.#b)throw new dX("Snapshot is not open: cannot use snapshot after close()",{code:"LEVEL_SNAPSHOT_NOT_OPEN"});this.#w++}unref(){if(--this.#w===0)this.#$?.()}async close(){if(this.#W!==null)return this.#W.catch(aX);if(this.#b=!1,this.#W=new Promise((b,w)=>{this.#$=()=>{this.#$=null,uX(this,this.#X).then(b,w)}}),this.#w===0)this.#$();return this.#W}async _close(){}}if(typeof Symbol.asyncDispose==="symbol")S3.prototype[Symbol.asyncDispose]=async function(){return this.close()};var uX=async function(b,w){await b._close(),w.detachResource(b)};pX.AbstractSnapshot=S3});var g2=M((nX)=>{nX.AbstractLevel=B3().AbstractLevel;nX.AbstractSublevel=B3().AbstractSublevel;nX.AbstractIterator=T0().AbstractIterator;nX.AbstractKeyIterator=T0().AbstractKeyIterator;nX.AbstractValueIterator=T0().AbstractValueIterator;nX.AbstractChainedBatch=z3().AbstractChainedBatch;nX.AbstractSnapshot=f9().AbstractSnapshot});var b6=M((Qj,e9)=>{var r9=S("fs"),S0=S("path"),y9=S("os"),d9=typeof __webpack_require__==="function"?__non_webpack_require__:S,UG=process.config&&process.config.variables||{},JG=!!process.env.PREBUILDS_ONLY,Z9=process.versions.modules,K3=XG()?"electron":_G()?"node-webkit":"node",D3=process.env.npm_config_arch||y9.arch(),O3=process.env.npm_config_platform||y9.platform(),a9=process.env.LIBC||(GG(O3)?"musl":"glibc"),F3=process.env.ARM_VERSION||(D3==="arm64"?"8":UG.arm_version)||"",u9=(process.versions.uv||"").split(".")[0];e9.exports=N0;function N0(b){return d9(N0.resolve(b))}N0.resolve=N0.path=function(b){b=S0.resolve(b||".");try{var w=d9(S0.join(b,"package.json")).name.toUpperCase().replace(/-/g,"_");if(process.env[w+"_PREBUILD"])b=process.env[w+"_PREBUILD"]}catch(G){}if(!JG){var $=g9(S0.join(b,"build/Release"),m9);if($)return $;var U=g9(S0.join(b,"build/Debug"),m9);if(U)return U}var J=X(b);if(J)return J;var W=X(S0.dirname(process.execPath));if(W)return W;var _=["platform="+O3,"arch="+D3,"runtime="+K3,"abi="+Z9,"uv="+u9,F3?"armv="+F3:"","libc="+a9,"node="+process.versions.node,process.versions.electron?"electron="+process.versions.electron:"",typeof __webpack_require__==="function"?"webpack=true":""].filter(Boolean).join(" ");throw new Error("No native build was found for "+_+`
    loaded from: `+b+`
`);function X(G){var Q=E3(S0.join(G,"prebuilds")).map(p9),H=Q.filter(o9(O3,D3)).sort(n9)[0];if(!H)return;var z=S0.join(G,"prebuilds",H.name),N=E3(z).map(i9),B=N.filter(s9(K3,Z9)),O=B.sort(t9(K3))[0];if(O)return S0.join(z,O.file)}};function E3(b){try{return r9.readdirSync(b)}catch(w){return[]}}function g9(b,w){var $=E3(b).filter(w);return $[0]&&S0.join(b,$[0])}function m9(b){return/\.node$/.test(b)}function p9(b){var w=b.split("-");if(w.length!==2)return;var $=w[0],U=w[1].split("+");if(!$)return;if(!U.length)return;if(!U.every(Boolean))return;return{name:b,platform:$,architectures:U}}function o9(b,w){return function($){if($==null)return!1;if($.platform!==b)return!1;return $.architectures.includes(w)}}function n9(b,w){return b.architectures.length-w.architectures.length}function i9(b){var w=b.split("."),$=w.pop(),U={file:b,specificity:0};if($!=="node")return;for(var J=0;J<w.length;J++){var W=w[J];if(W==="node"||W==="electron"||W==="node-webkit")U.runtime=W;else if(W==="napi")U.napi=!0;else if(W.slice(0,3)==="abi")U.abi=W.slice(3);else if(W.slice(0,2)==="uv")U.uv=W.slice(2);else if(W.slice(0,4)==="armv")U.armv=W.slice(4);else if(W==="glibc"||W==="musl")U.libc=W;else continue;U.specificity++}return U}function s9(b,w){return function($){if($==null)return!1;if($.runtime&&$.runtime!==b&&!WG($))return!1;if($.abi&&$.abi!==w&&!$.napi)return!1;if($.uv&&$.uv!==u9)return!1;if($.armv&&$.armv!==F3)return!1;if($.libc&&$.libc!==a9)return!1;return!0}}function WG(b){return b.runtime==="node"&&b.napi}function t9(b){return function(w,$){if(w.runtime!==$.runtime)return w.runtime===b?-1:1;else if(w.abi!==$.abi)return w.abi?-1:1;else if(w.specificity!==$.specificity)return w.specificity>$.specificity?-1:1;else return 0}}function _G(){return!!(process.versions&&process.versions.nw)}function XG(){if(process.versions&&process.versions.electron)return!0;if(process.env.ELECTRON_RUN_AS_NODE)return!0;return typeof window!=="undefined"&&window.process&&window.process.type==="renderer"}function GG(b){return b==="linux"&&r9.existsSync("/etc/alpine-release")}N0.parseTags=i9;N0.matchTags=s9;N0.compareTags=t9;N0.parseTuple=p9;N0.matchTuple=o9;N0.compareTuples=n9});var w6=M((Hj,k3)=>{var C3=typeof __webpack_require__==="function"?__non_webpack_require__:S;if(typeof C3.addon==="function")k3.exports=C3.addon.bind(C3);else k3.exports=b6()});var m2=M((qj,$6)=>{var __dirname="/home/alexstorm/distrib/4ir/converged/dag/node_modules/classic-level";$6.exports=w6()(__dirname)});var J6=M((YG)=>{var{AbstractChainedBatch:QG}=g2(),p1=m2(),o1=Symbol("context");class U6 extends QG{constructor(b,w){super(b);this[o1]=p1.batch_init(w)}_put(b,w){p1.batch_put(this[o1],b,w)}_del(b){p1.batch_del(this[o1],b)}_clear(){p1.batch_clear(this[o1])}async _write(b){return p1.batch_write(this[o1],b)}async _close(){}}YG.ChainedBatch=U6});var _6=M((qG)=>{var{AbstractIterator:jG}=g2(),u0=m2(),p0=Symbol("context"),b0=Symbol("cache"),n1=Symbol("first"),t=Symbol("position"),i1=Symbol("state"),o0=Symbol("signal"),s1=Symbol("abort"),P3=[];class W6 extends jG{constructor(b,w,$,U){super(b,$);if(this[i1]=new Uint8Array(1),this[p0]=u0.iterator_init(w,this[i1],$,U),this[n1]=!0,this[b0]=P3,this[t]=0,this[s1]=this[s1].bind(this),$.signal!=null)this[o0]=$.signal,this[o0].addEventListener("abort",this[s1],{once:!0});else this[o0]=null}_seek(b,w){this[n1]=!0,this[b0]=P3,this[i1][0]&=-2,this[t]=0,u0.iterator_seek(this[p0],b)}async _next(){if(this[t]<this[b0].length)return this[b0][this[t]++];if((this[i1][0]&1)!==0)return;if(this[n1])this[n1]=!1,this[b0]=await u0.iterator_nextv(this[p0],1),this[t]=0;else this[b0]=await u0.iterator_nextv(this[p0],1000),this[t]=0;if(this[t]<this[b0].length)return this[b0][this[t]++]}async _nextv(b,w){if(this[n1]=!1,this[t]<this[b0].length){let $=Math.min(b,this[b0].length-this[t]),U=this[b0].slice(this[t],this[t]+$);return this[t]+=$,U}if((this[i1][0]&1)!==0)return[];return u0.iterator_nextv(this[p0],b)}async _close(){if(this[b0]=P3,this[o0]!==null)this[o0].removeEventListener("abort",this[s1]),this[o0]=null;u0.iterator_close(this[p0])}[s1](){this[o0]=null,u0.iterator_abort(this[p0])}get cached(){return this[b0].length-this[t]}}qG.Iterator=W6});var H6=M((BG)=>{var{AbstractLevel:RG,AbstractSnapshot:MG}=g2(),I3=W0(),NG=S("fs/promises"),h=m2(),{ChainedBatch:AG}=J6(),{Iterator:cG}=_6(),k=Symbol("context"),r2=Symbol("location");class Q6 extends RG{#b=null;constructor(b,w){if(typeof b!=="string"||b==="")throw new TypeError("The first argument 'location' must be a non-empty string");super({encodings:{buffer:!0,utf8:!0,view:!0},has:!0,createIfMissing:!0,errorIfExists:!0,explicitSnapshots:!0,getSync:!0,additionalMethods:{approximateSize:!0,compactRange:!0},signals:{iterators:!0}},w);this[r2]=b,this[k]=h.db_init()}get location(){return this[r2]}async _open(b){if(b.createIfMissing)await NG.mkdir(this[r2],{recursive:!0});return h.db_open(this[k],this[r2],b)}async _close(){return h.db_close(this[k])}async _put(b,w,$){return h.db_put(this[k],b,w,$)}async _get(b,w){let $=0;if(w.fillCache!==!1)$|=X6;if(w.valueEncoding!=="utf8")$|=G6;if(w.keyEncoding!=="utf8"){if($|=LG,b.buffer.resizable)b=new Uint8Array(b)}return h.db_get(this[k],$,b,w.snapshot?.[k])}_getSync(b,w){let $=0;if(w.fillCache!==!1)$|=X6;if(w.valueEncoding!=="utf8")$|=G6;if(w.keyEncoding!=="utf8")return h.db_get_sync(this[k],$,b,w.snapshot?.[k]);else{let U;if(this.#b===null)U=this.#w(b);else if(U=this.#b.write(b),U===this.#b.byteLength)U=this.#w(b);return h.db_get_sync(this[k],$|VG,U,w.snapshot?.[k])}}#w(b){return this.#b=Buffer.allocUnsafe(Buffer.byteLength(b)+64),h.db_set_shared_buffer(this[k],this.#b),this.#b.write(b)}async _getMany(b,w){return h.db_get_many(this[k],b,w,w.snapshot?.[k])}async _has(b,w){return h.db_has(this[k],b,w.fillCache,w.snapshot?.[k])}async _hasMany(b,w){let $=b.length+32>>>5,U=new ArrayBuffer($*4),J=new Uint32Array(U);await h.db_has_many(this[k],b,w.fillCache,w.snapshot?.[k],U);let W=new Array(b.length);for(let _=0;_<W.length;_++)W[_]=(J[_>>>5]&1<<(_&31))!==0;return W}async _del(b,w){return h.db_del(this[k],b,w)}async _clear(b){return h.db_clear(this[k],b,b.snapshot?.[k])}_chainedBatch(){return new AG(this,this[k])}async _batch(b,w){return h.batch_do(this[k],b,w)}async approximateSize(b,w,$){if(arguments.length<2)throw new TypeError("The arguments 'start' and 'end' are required");else if(typeof $!=="object")$=null;if(this.status==="opening")return this.deferAsync(()=>this.approximateSize(b,w,$));else if(this.status!=="open")throw new I3("Database is not open: cannot call approximateSize()",{code:"LEVEL_DATABASE_NOT_OPEN"});else{let U=this.keyEncoding($&&$.keyEncoding);return b=U.encode(b),w=U.encode(w),h.db_approximate_size(this[k],b,w)}}async compactRange(b,w,$){if(arguments.length<2)throw new TypeError("The arguments 'start' and 'end' are required");else if(typeof $!=="object")$=null;if(this.status==="opening")return this.deferAsync(()=>this.compactRange(b,w,$));else if(this.status!=="open")throw new I3("Database is not open: cannot call compactRange()",{code:"LEVEL_DATABASE_NOT_OPEN"});else{let U=this.keyEncoding($&&$.keyEncoding);return b=U.encode(b),w=U.encode(w),h.db_compact_range(this[k],b,w)}}getProperty(b){if(typeof b!=="string")throw new TypeError("The first argument 'property' must be a string");if(this.status!=="open")throw new I3("Database is not open",{code:"LEVEL_DATABASE_NOT_OPEN"});return h.db_get_property(this[k],b)}_iterator(b){return new cG(this,this[k],b,b.snapshot?.[k])}_snapshot(b){return new Y6(this[k],b)}static async destroy(b){if(typeof b!=="string"||b==="")throw new TypeError("The first argument 'location' must be a non-empty string");return h.destroy_db(b)}static async repair(b){if(typeof b!=="string"||b==="")throw new TypeError("The first argument 'location' must be a non-empty string");return h.repair_db(b)}}class Y6 extends MG{constructor(b,w){super(w);this[k]=h.snapshot_init(b)}async _close(){h.snapshot_close(this[k])}}BG.ClassicLevel=Q6;var X6=1,LG=2,G6=4,VG=8});import{Elysia as OG}from"elysia";import{Elysia as p7}from"elysia";var f3=`/* basic theme */
:root {
  --scalar-text-decoration: underline;
  --scalar-text-decoration-hover: underline;
}
.light-mode,
.light-mode .dark-mode {
  --scalar-background-1: #f9f9f9;
  --scalar-background-2: #f1f1f1;
  --scalar-background-3: #e7e7e7;
  --scalar-background-card: #fff;

  --scalar-color-1: #2a2f45;
  --scalar-color-2: #757575;
  --scalar-color-3: #8e8e8e;

  --scalar-color-accent: var(--scalar-color-1);
  --scalar-background-accent: var(--scalar-background-3);

  --scalar-border-color: rgba(0, 0, 0, 0.1);
}
.dark-mode {
  --scalar-background-1: #131313;
  --scalar-background-2: #1d1d1d;
  --scalar-background-3: #272727;
  --scalar-background-card: #1d1d1d;

  --scalar-color-1: rgba(255, 255, 255, 0.9);
  --scalar-color-2: rgba(255, 255, 255, 0.62);
  --scalar-color-3: rgba(255, 255, 255, 0.44);

  --scalar-color-accent: var(--scalar-color-1);
  --scalar-background-accent: var(--scalar-background-3);

  --scalar-border-color: #2a2b2a;
}
/* Document Sidebar */
.light-mode .t-doc__sidebar,
.dark-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-border-color: var(--scalar-border-color);

  --scalar-sidebar-item-hover-background: var(--scalar-background-2);
  --scalar-sidebar-item-hover-color: currentColor;

  --scalar-sidebar-item-active-background: var(--scalar-background-accent);
  --scalar-sidebar-color-active: var(--scalar-color-accent);

  --scalar-sidebar-search-background: transparent;
  --scalar-sidebar-search-color: var(--scalar-color-3);
  --scalar-sidebar-search-border-color: var(--scalar-border-color);
}
/* advanced */
.light-mode .dark-mode,
.light-mode {
  --scalar-color-green: #069061;
  --scalar-color-red: #ef0006;
  --scalar-color-yellow: #edbe20;
  --scalar-color-blue: #0082d0;
  --scalar-color-orange: #fb892c;
  --scalar-color-purple: #5203d1;

  --scalar-button-1: rgba(0, 0, 0, 1);
  --scalar-button-1-hover: rgba(0, 0, 0, 0.8);
  --scalar-button-1-color: rgba(255, 255, 255, 0.9);
}
.dark-mode {
  --scalar-color-green: #00b648;
  --scalar-color-red: #dd2f2c;
  --scalar-color-yellow: #ffc90d;
  --scalar-color-blue: #4eb3ec;
  --scalar-color-orange: #ff8d4d;
  --scalar-color-purple: #b191f9;

  --scalar-button-1: rgba(255, 255, 255, 1);
  --scalar-button-1-hover: rgba(255, 255, 255, 0.9);
  --scalar-button-1-color: black;
}

.scalar-api-client__item,
.scalar-card,
.dark-mode .dark-mode.scalar-card {
  --scalar-background-1: var(--scalar-background-card);
  --scalar-background-2: var(--scalar-background-1);
  --scalar-background-3: var(--scalar-background-1);
}
.dark-mode .dark-mode.scalar-card {
  --scalar-background-3: var(--scalar-background-3);
}
.t-doc__sidebar {
  --scalar-color-green: var(--scalar-color-1);
  --scalar-color-red: var(--scalar-color-1);
  --scalar-color-yellow: var(--scalar-color-1);
  --scalar-color-blue: var(--scalar-color-1);
  --scalar-color-orange: var(--scalar-color-1);
  --scalar-color-purple: var(--scalar-color-1);
}
.light-mode *::selection {
  background-color: color-mix(in srgb, var(--scalar-color-blue), transparent 70%);
}
.dark-mode *::selection {
  background-color: color-mix(in srgb, var(--scalar-color-blue), transparent 50%);
}
`;var Z3=`/* basic theme */
:root {
  --scalar-text-decoration: underline;
  --scalar-text-decoration-hover: underline;
}
.light-mode {
  --scalar-background-1: #f0f2f5;
  --scalar-background-2: #eaecf0;
  --scalar-background-3: #e0e2e6;
  --scalar-border-color: rgb(213 213 213);

  --scalar-color-1: rgb(9, 9, 11);
  --scalar-color-2: rgb(113, 113, 122);
  --scalar-color-3: rgba(25, 25, 28, 0.5);

  --scalar-color-accent: var(--scalar-color-1);
  --scalar-background-accent: #8ab4f81f;
}
.light-mode .scalar-card.dark-mode,
.dark-mode {
  --scalar-background-1: #000e23;
  --scalar-background-2: #01132e;
  --scalar-background-3: #03193b;
  --scalar-border-color: #2e394c;

  --scalar-color-1: #fafafa;
  --scalar-color-2: rgb(161, 161, 170);
  --scalar-color-3: rgba(255, 255, 255, 0.533);

  --scalar-color-accent: var(--scalar-color-1);
  --scalar-background-accent: #8ab4f81f;

  --scalar-code-language-color-supersede: var(--scalar-color-1);
}
/* Document Sidebar */
.light-mode .t-doc__sidebar,
.dark-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-border-color: var(--scalar-border-color);

  --scalar-sidebar-item-hover-background: var(--scalar-background-2);
  --scalar-sidebar-item-hover-color: currentColor;

  --scalar-sidebar-item-active-background: var(--scalar-background-3);
  --scalar-sidebar-color-active: var(--scalar-color-accent);

  --scalar-sidebar-search-background: rgba(255, 255, 255, 0.1);
  --scalar-sidebar-search-border-color: var(--scalar-border-color);
  --scalar-sidebar-search-color: var(--scalar-color-3);
  z-index: 1;
}
.light-mode .t-doc__sidebar {
  --scalar-sidebar-search-background: white;
}
/* advanced */
.light-mode {
  --scalar-color-green: #069061;
  --scalar-color-red: #ef0006;
  --scalar-color-yellow: #edbe20;
  --scalar-color-blue: #0082d0;
  --scalar-color-orange: #fb892c;
  --scalar-color-purple: #5203d1;

  --scalar-button-1: rgba(0, 0, 0, 1);
  --scalar-button-1-hover: rgba(0, 0, 0, 0.8);
  --scalar-button-1-color: rgba(255, 255, 255, 0.9);
}
.dark-mode {
  --scalar-color-green: rgba(69, 255, 165, 0.823);
  --scalar-color-red: #ff8589;
  --scalar-color-yellow: #ffcc4d;
  --scalar-color-blue: #6bc1fe;
  --scalar-color-orange: #f98943;
  --scalar-color-purple: #b191f9;

  --scalar-button-1: rgba(255, 255, 255, 1);
  --scalar-button-1-hover: rgba(255, 255, 255, 0.9);
  --scalar-button-1-color: black;
}
/* Custom theme */
/* Document header */
@keyframes headerbackground {
  from {
    background: transparent;
    backdrop-filter: none;
  }
  to {
    background: var(--header-background-1);
    backdrop-filter: blur(12px);
  }
}
.dark-mode h2.t-editor__heading,
.dark-mode .t-editor__page-title h1,
.dark-mode h1.section-header:not(::selection),
.dark-mode .markdown h1,
.dark-mode .markdown h2,
.dark-mode .markdown h3,
.dark-mode .markdown h4,
.dark-mode .markdown h5,
.dark-mode .markdown h6 {
  -webkit-text-fill-color: transparent;
  background-image: linear-gradient(to right bottom, rgb(255, 255, 255) 30%, rgba(255, 255, 255, 0.38));
  -webkit-background-clip: text;
  background-clip: text;
}
/* Hero Section Flare */
.section-flare-item:nth-of-type(1) {
  --c1: #ffffff;
  --c2: #babfd8;
  --c3: #2e8bb2;
  --c4: #1a8593;
  --c5: #0a143e;
  --c6: #0a0f52;
  --c7: #2341b8;

  --solid: var(--c1), var(--c2), var(--c3), var(--c4), var(--c5), var(--c6), var(--c7);
  --solid-wrap: var(--solid), var(--c1);
  --trans:
    var(--c1), transparent, var(--c2), transparent, var(--c3),
    transparent, var(--c4), transparent, var(--c5), transparent, var(--c6),
    transparent, var(--c7);
  --trans-wrap: var(--trans), transparent, var(--c1);

  background: radial-gradient(circle, var(--trans)), conic-gradient(from 180deg, var(--trans-wrap)),
    radial-gradient(circle, var(--trans)), conic-gradient(var(--solid-wrap));
  width: 70vw;
  height: 700px;
  border-radius: 50%;
  filter: blur(100px);
  z-index: 0;
  right: 0;
  position: absolute;
  transform: rotate(-45deg);
  top: -300px;
  opacity: 0.3;
}
.section-flare-item:nth-of-type(3) {
  --star-color: #6b9acc;
  --star-color2: #446b8d;
  --star-color3: #3e5879;
  background-image: radial-gradient(2px 2px at 20px 30px, var(--star-color2), rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 40px 70px, var(--star-color), rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 50px 160px, var(--star-color3), rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 90px 40px, var(--star-color), rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 130px 80px, var(--star-color), rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 160px 120px, var(--star-color3), rgba(0, 0, 0, 0));
  background-repeat: repeat;
  background-size: 200px 200px;
  width: 100%;
  height: 100%;
  mask-image: radial-gradient(ellipse at 100% 0%, black 40%, transparent 70%);
}
.section-flare {
  top: -150px !important;
  height: 100vh;
  background: linear-gradient(#000, var(--scalar-background-1));
  width: 100vw;
  overflow-x: hidden;
}
.light-mode .section-flare {
  display: none;
}
.light-mode .scalar-card {
  --scalar-background-1: #fff;
  --scalar-background-2: #fff;
  --scalar-background-3: #fff;
}

*::selection {
  background-color: color-mix(in srgb, var(--scalar-color-blue), transparent 60%);
}
`;var g3=`/* basic theme */
:root {
  --scalar-text-decoration: underline;
  --scalar-text-decoration-hover: underline;
}
.light-mode {
  --scalar-color-1: rgb(9, 9, 11);
  --scalar-color-2: rgb(113, 113, 122);
  --scalar-color-3: rgba(25, 25, 28, 0.5);
  --scalar-color-accent: var(--scalar-color-1);

  --scalar-background-1: #fff;
  --scalar-background-2: #f4f4f5;
  --scalar-background-3: #e3e3e6;
  --scalar-background-accent: #8ab4f81f;

  --scalar-border-color: rgb(228, 228, 231);
  --scalar-code-language-color-supersede: var(--scalar-color-1);
}
.dark-mode {
  --scalar-color-1: #fafafa;
  --scalar-color-2: rgb(161, 161, 170);
  --scalar-color-3: rgba(255, 255, 255, 0.533);
  --scalar-color-accent: var(--scalar-color-1);

  --scalar-background-1: #09090b;
  --scalar-background-2: #18181b;
  --scalar-background-3: #2c2c30;
  --scalar-background-accent: #8ab4f81f;

  --scalar-border-color: rgba(255, 255, 255, 0.16);
  --scalar-code-language-color-supersede: var(--scalar-color-1);
}

/* Document Sidebar */
.light-mode .t-doc__sidebar,
.dark-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-border-color: var(--scalar-border-color);

  --scalar-sidebar-item-hover-color: currentColor;
  --scalar-sidebar-item-hover-background: var(--scalar-background-2);

  --scalar-sidebar-item-active-background: var(--scalar-background-3);
  --scalar-sidebar-color-active: var(--scalar-color-accent);

  --scalar-sidebar-search-background: transparent;
  --scalar-sidebar-search-border-color: var(--scalar-border-color);
  --scalar-sidebar-search-color: var(--scalar-color-3);
}
.light-mode .t-doc__sidebar {
  --scalar-sidebar-item-active-background: var(--scalar-background-2);
}
/* advanced */
.light-mode {
  --scalar-color-green: #069061;
  --scalar-color-red: #ef0006;
  --scalar-color-yellow: #edbe20;
  --scalar-color-blue: #0082d0;
  --scalar-color-orange: #fb892c;
  --scalar-color-purple: #5203d1;

  --scalar-button-1: rgba(0, 0, 0, 1);
  --scalar-button-1-hover: rgba(0, 0, 0, 0.8);
  --scalar-button-1-color: rgba(255, 255, 255, 0.9);
}
.dark-mode {
  --scalar-color-green: rgba(69, 255, 165, 0.823);
  --scalar-color-red: #ff8589;
  --scalar-color-yellow: #ffcc4d;
  --scalar-color-blue: #6bc1fe;
  --scalar-color-orange: #f98943;
  --scalar-color-purple: #b191f9;

  --scalar-button-1: rgba(255, 255, 255, 1);
  --scalar-button-1-hover: rgba(255, 255, 255, 0.9);
  --scalar-button-1-color: black;
}
/* Custom theme */
.dark-mode h2.t-editor__heading,
.dark-mode .t-editor__page-title h1,
.dark-mode h1.section-header:not(::selection),
.dark-mode .markdown h1,
.dark-mode .markdown h2,
.dark-mode .markdown h3,
.dark-mode .markdown h4,
.dark-mode .markdown h5,
.dark-mode .markdown h6 {
  -webkit-text-fill-color: transparent;
  background-image: linear-gradient(to right bottom, rgb(255, 255, 255) 30%, rgba(255, 255, 255, 0.38));
  -webkit-background-clip: text;
  background-clip: text;
}
.examples .scalar-card-footer {
  --scalar-background-3: transparent;
  padding-top: 0;
}
/* Hero section flare */
.section-flare {
  width: 100vw;
  height: 550px;
  position: absolute;
}
.section-flare-item:nth-of-type(1) {
  position: absolute;
  width: 100vw;
  height: 550px;
  --stripesDark: repeating-linear-gradient(100deg, #000 0%, #000 7%, transparent 10%, transparent 12%, #000 16%);
  --rainbow: repeating-linear-gradient(100deg, #fff 10%, #fff 16%, #fff 22%, #fff 30%);
  background-image: var(--stripesDark), var(--rainbow);
  background-size: 300%, 200%;
  background-position: 50% 50%, 50% 50%;
  filter: invert(100%);
  -webkit-mask-image: radial-gradient(ellipse at 100% 0%, black 40%, transparent 70%);
  mask-image: radial-gradient(ellipse at 100% 0%, black 40%, transparent 70%);
  pointer-events: none;
  opacity: 0.07;
}
.dark-mode .section-flare-item:nth-of-type(1) {
  background-image: var(--stripesDark), var(--rainbow);
  filter: opacity(50%) saturate(200%);
  opacity: 0.25;
  height: 350px;
}
.section-flare-item:nth-of-type(1):after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-image: var(--stripesDark), var(--rainbow);
  background-size: 200%, 100%;
  background-attachment: fixed;
  mix-blend-mode: difference;
}
.dark-mode .section-flare:after {
  background-image: var(--stripesDark), var(--rainbow);
}
.section-flare-item:nth-of-type(2) {
  --star-color: #fff;
  --star-color2: #fff;
  --star-color3: #fff;
  width: 100%;
  height: 100%;
  position: absolute;
  background-image: radial-gradient(2px 2px at 20px 30px, var(--star-color2), rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 40px 70px, var(--star-color), rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 50px 160px, var(--star-color3), rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 90px 40px, var(--star-color), rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 130px 80px, var(--star-color), rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 160px 120px, var(--star-color3), rgba(0, 0, 0, 0));
  background-repeat: repeat;
  background-size: 200px 200px;
  mask-image: radial-gradient(ellipse at 100% 0%, black 40%, transparent 70%);
  opacity: 0.2;
}
.light-mode *::selection {
  background-color: color-mix(in srgb, var(--scalar-color-blue), transparent 70%);
}
.dark-mode *::selection {
  background-color: color-mix(in srgb, var(--scalar-color-blue), transparent 50%);
}
`;var m3=`/* basic theme */
.light-mode {
  --scalar-background-1: #fff;
  --scalar-background-2: #f6f6f6;
  --scalar-background-3: #e7e7e7;
  --scalar-background-accent: #8ab4f81f;

  --scalar-color-1: #2a2f45;
  --scalar-color-2: #757575;
  --scalar-color-3: #8e8e8e;

  --scalar-color-accent: #0099ff;
  --scalar-border-color: #dfdfdf;
}
.dark-mode {
  --scalar-background-1: #0f0f0f;
  --scalar-background-2: #1a1a1a;
  --scalar-background-3: #272727;

  --scalar-color-1: #e7e7e7;
  --scalar-color-2: #a4a4a4;
  --scalar-color-3: #797979;

  --scalar-color-accent: #3ea6ff;
  --scalar-background-accent: #3ea6ff1f;

  --scalar-border-color: #2d2d2d;
}
/* Document Sidebar */
.light-mode .t-doc__sidebar,
.dark-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-border-color: var(--scalar-border-color);

  --scalar-sidebar-item-hover-background: var(--scalar-background-2);
  --scalar-sidebar-item-hover-color: currentColor;

  --scalar-sidebar-item-active-background: var(--scalar-background-2);
  --scalar-sidebar-color-active: var(--scalar-color-1);

  --scalar-sidebar-indent-border: var(--scalar-sidebar-border-color);
  --scalar-sidebar-indent-border-hover: var(--scalar-sidebar-border-color);
  --scalar-sidebar-indent-border-active: var(--scalar-sidebar-border-color);

  --scalar-sidebar-search-background: transparent;
  --scalar-sidebar-search-color: var(--scalar-color-3);
  --scalar-sidebar-search-border-color: var(--scalar-border-color);
}
/* advanced */
.light-mode {
  --scalar-color-green: #069061;
  --scalar-color-red: #ef0006;
  --scalar-color-yellow: #edbe20;
  --scalar-color-blue: #0082d0;
  --scalar-color-orange: #fb892c;
  --scalar-color-purple: #5203d1;

  --scalar-button-1: rgba(0, 0, 0, 1);
  --scalar-button-1-hover: rgba(0, 0, 0, 0.8);
  --scalar-button-1-color: rgba(255, 255, 255, 0.9);

  --scalar-color-danger: color-mix(in srgb, var(--scalar-color-red), var(--scalar-color-1) 20%);

  --scalar-background-alert: color-mix(in srgb, var(--scalar-color-orange), var(--scalar-background-1) 95%);
  --scalar-background-danger: color-mix(in srgb, var(--scalar-color-red), var(--scalar-background-1) 95%);
}
.dark-mode {
  --scalar-color-green: #00b648;
  --scalar-color-red: #dc1b19;
  --scalar-color-yellow: #ffc90d;
  --scalar-color-blue: #4eb3ec;
  --scalar-color-orange: #ff8d4d;
  --scalar-color-purple: #b191f9;

  --scalar-button-1: rgba(255, 255, 255, 1);
  --scalar-button-1-hover: rgba(255, 255, 255, 0.9);
  --scalar-button-1-color: black;

  --scalar-color-danger: color-mix(in srgb, var(--scalar-color-red), var(--scalar-background-1) 20%);

  --scalar-background-alert: color-mix(in srgb, var(--scalar-color-orange), var(--scalar-background-1) 95%);
  --scalar-background-danger: color-mix(in srgb, var(--scalar-color-red), var(--scalar-background-1) 95%);
}
@supports (color: color(display-p3 1 1 1)) {
  .light-mode {
    --scalar-color-accent: color(display-p3 0.0 0.6 1.0 / 1.0);
    --scalar-color-green: color(display-p3 0.023529 0.564706 0.380392 / 1.0);
    --scalar-color-red: color(display-p3 0.937255 0.0 0.023529 / 1.0);
    --scalar-color-yellow: color(display-p3 0.929412 0.745098 0.12549 / 1.0);
    --scalar-color-blue: color(display-p3 0.0 0.509804 0.815686 / 1.0);
    --scalar-color-orange: color(display-p3 0.984314 0.537255 0.172549 / 1.0);
    --scalar-color-purple: color(display-p3 0.321569 0.011765 0.819608 / 1.0);
  }
  .dark-mode {
    --scalar-color-accent: color(display-p3 0.243137 0.65098 1.0 / 1.0);
    --scalar-color-green: color(display-p3 0.0 0.713725 0.282353 / 1.0);
    --scalar-color-red: color(display-p3 0.862745 0.105882 0.098039 / 1.0);
    --scalar-color-yellow: color(display-p3 1.0 0.788235 0.05098 / 1.0);
    --scalar-color-blue: color(display-p3 0.305882 0.701961 0.92549 / 1.0);
    --scalar-color-orange: color(display-p3 1.0 0.552941 0.301961 / 1.0);
    --scalar-color-purple: color(display-p3 0.694118 0.568627 0.976471 / 1.0);
  }
}
`;var t1=`.light-mode {
  --scalar-color-1: #2a2f45;
  --scalar-color-2: #757575;
  --scalar-color-3: #8e8e8e;
  --scalar-color-accent: #f06292;

  --scalar-background-1: #fff;
  --scalar-background-2: #f6f6f6;
  --scalar-background-3: #e7e7e7;

  --scalar-border-color: rgba(0, 0, 0, 0.1);
}
.dark-mode {
  --scalar-color-1: rgba(255, 255, 255, 0.9);
  --scalar-color-2: rgba(156, 163, 175, 1);
  --scalar-color-3: rgba(255, 255, 255, 0.44);
  --scalar-color-accent: #f06292;

  --scalar-background-1: #111728;
  --scalar-background-2: #1e293b;
  --scalar-background-3: #334155;
  --scalar-background-accent: #f062921f;

  --scalar-border-color: rgba(255, 255, 255, 0.1);
}

/* Document Sidebar */
.light-mode .t-doc__sidebar,
.dark-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-border-color: var(--scalar-border-color);

  --scalar-sidebar-item-hover-background: var(--scalar-background-2);
  --scalar-sidebar-item-hover-color: currentColor;

  --scalar-sidebar-item-active-background: #f062921f;
  --scalar-sidebar-color-active: var(--scalar-color-accent);

  --scalar-sidebar-search-background: transparent;
  --scalar-sidebar-search-color: var(--scalar-color-3);
  --scalar-sidebar-search-border-color: var(--scalar-border-color);
}

/* advanced */
.light-mode {
  --scalar-button-1: rgb(49 53 56);
  --scalar-button-1-color: #fff;
  --scalar-button-1-hover: rgb(28 31 33);

  --scalar-color-green: #069061;
  --scalar-color-red: #ef0006;
  --scalar-color-yellow: #edbe20;
  --scalar-color-blue: #0082d0;
  --scalar-color-orange: #fb892c;
  --scalar-color-purple: #5203d1;

  --scalar-scrollbar-color: rgba(0, 0, 0, 0.18);
  --scalar-scrollbar-color-active: rgba(0, 0, 0, 0.36);
}
.dark-mode {
  --scalar-button-1: #f6f6f6;
  --scalar-button-1-color: #000;
  --scalar-button-1-hover: #e7e7e7;

  --scalar-color-green: #a3ffa9;
  --scalar-color-red: #ffa3a3;
  --scalar-color-yellow: #fffca3;
  --scalar-color-blue: #a5d6ff;
  --scalar-color-orange: #e2ae83;
  --scalar-color-purple: #d2a8ff;

  --scalar-scrollbar-color: rgba(255, 255, 255, 0.24);
  --scalar-scrollbar-color-active: rgba(255, 255, 255, 0.48);
}
.section-flare {
  width: 100%;
  height: 400px;
  position: absolute;
}
.section-flare-item:first-of-type:before {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  --stripes: repeating-linear-gradient(100deg, #fff 0%, #fff 0%, transparent 2%, transparent 12%, #fff 17%);
  --stripesDark: repeating-linear-gradient(100deg, #000 0%, #000 0%, transparent 10%, transparent 12%, #000 17%);
  --rainbow: repeating-linear-gradient(100deg, #60a5fa 10%, #e879f9 16%, #5eead4 22%, #60a5fa 30%);
  contain: strict;
  contain-intrinsic-size: 100vw 40vh;
  background-image: var(--stripesDark), var(--rainbow);
  background-size: 300%, 200%;
  background-position: 50% 50%, 50% 50%;
  filter: opacity(20%) saturate(200%);
  -webkit-mask-image: radial-gradient(ellipse at 100% 0%, black 40%, transparent 70%);
  mask-image: radial-gradient(ellipse at 100% 0%, black 40%, transparent 70%);
  pointer-events: none;
}
.section-flare-item:first-of-type:after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-image: var(--stripes), var(--rainbow);
  background-size: 200%, 100%;
  background-attachment: fixed;
  mix-blend-mode: difference;
  background-image: var(--stripesDark), var(--rainbow);
  pointer-events: none;
}
.light-mode .section-flare-item:first-of-type:after,
.light-mode .section-flare-item:first-of-type:before {
  background-image: var(--stripes), var(--rainbow);
  filter: opacity(4%) saturate(200%);
}
`;var r3=`.light-mode {
  color-scheme: light;
  --scalar-color-1: #1c1e21;
  --scalar-color-2: #757575;
  --scalar-color-3: #8e8e8e;
  --scalar-color-disabled: #b4b1b1;
  --scalar-color-ghost: #a7a7a7;
  --scalar-color-accent: #2f8555;
  --scalar-background-1: #fff;
  --scalar-background-2: #f5f5f5;
  --scalar-background-3: #ededed;
  --scalar-background-4: rgba(0, 0, 0, 0.06);
  --scalar-background-accent: #2f85551f;

  --scalar-border-color: rgba(0, 0, 0, 0.1);
  --scalar-scrollbar-color: rgba(0, 0, 0, 0.18);
  --scalar-scrollbar-color-active: rgba(0, 0, 0, 0.36);
  --scalar-lifted-brightness: 1;
  --scalar-backdrop-brightness: 1;

  --scalar-shadow-1: 0 1px 3px 0 rgba(0, 0, 0, 0.11);
  --scalar-shadow-2: rgba(0, 0, 0, 0.08) 0px 13px 20px 0px, rgba(0, 0, 0, 0.08) 0px 3px 8px 0px, #eeeeed 0px 0 0 1px;

  --scalar-button-1: rgb(49 53 56);
  --scalar-button-1-color: #fff;
  --scalar-button-1-hover: rgb(28 31 33);

  --scalar-color-green: #007300;
  --scalar-color-red: #af272b;
  --scalar-color-yellow: #b38200;
  --scalar-color-blue: #3b8ba5;
  --scalar-color-orange: #fb892c;
  --scalar-color-purple: #5203d1;
}

.dark-mode {
  color-scheme: dark;
  --scalar-color-1: rgba(255, 255, 255, 0.9);
  --scalar-color-2: rgba(255, 255, 255, 0.62);
  --scalar-color-3: rgba(255, 255, 255, 0.44);
  --scalar-color-disabled: rgba(255, 255, 255, 0.34);
  --scalar-color-ghost: rgba(255, 255, 255, 0.26);
  --scalar-color-accent: #27c2a0;
  --scalar-background-1: #1b1b1d;
  --scalar-background-2: #242526;
  --scalar-background-3: #3b3b3b;
  --scalar-background-4: rgba(255, 255, 255, 0.06);
  --scalar-background-accent: #27c2a01f;

  --scalar-border-color: rgba(255, 255, 255, 0.1);
  --scalar-scrollbar-color: rgba(255, 255, 255, 0.24);
  --scalar-scrollbar-color-active: rgba(255, 255, 255, 0.48);
  --scalar-lifted-brightness: 1.45;
  --scalar-backdrop-brightness: 0.5;

  --scalar-shadow-1: 0 1px 3px 0 rgb(0, 0, 0, 0.1);
  --scalar-shadow-2: rgba(15, 15, 15, 0.2) 0px 3px 6px, rgba(15, 15, 15, 0.4) 0px 9px 24px, 0 0 0 1px
    rgba(255, 255, 255, 0.1);

  --scalar-button-1: #f6f6f6;
  --scalar-button-1-color: #000;
  --scalar-button-1-hover: #e7e7e7;

  --scalar-color-green: #26b226;
  --scalar-color-red: #fb565b;
  --scalar-color-yellow: #ffc426;
  --scalar-color-blue: #6ecfef;
  --scalar-color-orange: #ff8d4d;
  --scalar-color-purple: #b191f9;
}
`;var y3=`/* basic theme */
.light-mode {
  --scalar-color-1: #2a2f45;
  --scalar-color-2: #757575;
  --scalar-color-3: #8e8e8e;
  --scalar-color-accent: #7070ff;

  --scalar-background-1: #fff;
  --scalar-background-2: #f6f6f6;
  --scalar-background-3: #e7e7e7;
  --scalar-background-accent: #7070ff1f;

  --scalar-border-color: rgba(0, 0, 0, 0.1);

  --scalar-code-language-color-supersede: var(--scalar-color-3);
}
.dark-mode {
  --scalar-color-1: #f7f8f8;
  --scalar-color-2: rgb(180, 188, 208);
  --scalar-color-3: #b4bcd099;
  --scalar-color-accent: #828fff;

  --scalar-background-1: #000212;
  --scalar-background-2: #0d0f1e;
  --scalar-background-3: #232533;
  --scalar-background-accent: #8ab4f81f;

  --scalar-border-color: #313245;
  --scalar-code-language-color-supersede: var(--scalar-color-3);
}
/* Document Sidebar */
.light-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-item-hover-color: currentColor;
  --scalar-sidebar-item-hover-background: var(--scalar-background-2);
  --scalar-sidebar-item-active-background: var(--scalar-background-accent);
  --scalar-sidebar-border-color: var(--scalar-border-color);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-color-active: var(--scalar-color-accent);
  --scalar-sidebar-search-background: rgba(0, 0, 0, 0.05);
  --scalar-sidebar-search-border-color: 1px solid rgba(0, 0, 0, 0.05);
  --scalar-sidebar-search-color: var(--scalar-color-3);
  --scalar-background-2: rgba(0, 0, 0, 0.03);
}
.dark-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-item-hover-color: currentColor;
  --scalar-sidebar-item-hover-background: var(--scalar-background-2);
  --scalar-sidebar-item-active-background: rgba(255, 255, 255, 0.1);
  --scalar-sidebar-border-color: var(--scalar-border-color);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-color-active: var(--scalar-color-accent);
  --scalar-sidebar-search-background: rgba(255, 255, 255, 0.1);
  --scalar-sidebar-search-border-color: 1px solid rgba(255, 255, 255, 0.05);
  --scalar-sidebar-search-color: var(--scalar-color-3);
}
/* advanced */
.light-mode {
  --scalar-color-green: #069061;
  --scalar-color-red: #ef0006;
  --scalar-color-yellow: #edbe20;
  --scalar-color-blue: #0082d0;
  --scalar-color-orange: #fb892c;
  --scalar-color-purple: #5203d1;

  --scalar-button-1: rgba(0, 0, 0, 1);
  --scalar-button-1-hover: rgba(0, 0, 0, 0.8);
  --scalar-button-1-color: rgba(255, 255, 255, 0.9);
}
.dark-mode {
  --scalar-color-green: #00b648;
  --scalar-color-red: #dc1b19;
  --scalar-color-yellow: #ffc90d;
  --scalar-color-blue: #4eb3ec;
  --scalar-color-orange: #ff8d4d;
  --scalar-color-purple: #b191f9;

  --scalar-button-1: rgba(255, 255, 255, 1);
  --scalar-button-1-hover: rgba(255, 255, 255, 0.9);
  --scalar-button-1-color: black;
}
/* Custom Theme */
.dark-mode h2.t-editor__heading,
.dark-mode .t-editor__page-title h1,
.dark-mode h1.section-header:not(::selection),
.dark-mode .markdown h1,
.dark-mode .markdown h2,
.dark-mode .markdown h3,
.dark-mode .markdown h4,
.dark-mode .markdown h5,
.dark-mode .markdown h6 {
  -webkit-text-fill-color: transparent;
  background-image: linear-gradient(to right bottom, rgb(255, 255, 255) 30%, rgba(255, 255, 255, 0.38));
  -webkit-background-clip: text;
  background-clip: text;
}
.sidebar-search {
  backdrop-filter: blur(12px);
}
@keyframes headerbackground {
  from {
    background: transparent;
    backdrop-filter: none;
  }
  to {
    background: var(--header-background-1);
    backdrop-filter: blur(12px);
  }
}
.dark-mode .scalar-card {
  background: rgba(255, 255, 255, 0.05) !important;
}
.dark-mode .scalar-card * {
  --scalar-background-2: transparent !important;
  --scalar-background-1: transparent !important;
}
.light-mode .dark-mode.scalar-card *,
.light-mode .dark-mode.scalar-card {
  --scalar-background-1: #0d0f1e !important;
  --scalar-background-2: #0d0f1e !important;
  --scalar-background-3: #191b29 !important;
}
.light-mode .dark-mode.scalar-card {
  background: #191b29 !important;
}
.badge {
  box-shadow: 0 0 0 1px var(--scalar-border-color);
  margin-right: 6px;
}

.table-row.required-parameter .table-row-item:nth-of-type(2):after {
  background: transparent;
  box-shadow: none;
}
/* Hero Section Flare */
.section-flare {
  width: 100vw;
  background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(120, 119, 198, 0.3), transparent);
  height: 100vh;
}
.light-mode *::selection {
  background-color: color-mix(in srgb, var(--scalar-color-accent), transparent 70%);
}
.dark-mode *::selection {
  background-color: color-mix(in srgb, var(--scalar-color-accent), transparent 50%);
}
`;var d3=`/* basic theme */
:root {
  --scalar-text-decoration: underline;
  --scalar-text-decoration-hover: underline;
}
.light-mode {
  --scalar-background-1: #f9f6f0;
  --scalar-background-2: #f2efe8;
  --scalar-background-3: #e9e7e2;
  --scalar-border-color: rgba(203, 165, 156, 0.6);

  --scalar-color-1: #c75549;
  --scalar-color-2: #c75549;
  --scalar-color-3: #c75549;

  --scalar-color-accent: #c75549;
  --scalar-background-accent: #dcbfa81f;

  --scalar-code-language-color-supersede: var(--scalar-color-1);
}
.dark-mode {
  --scalar-background-1: #140507;
  --scalar-background-2: #20090c;
  --scalar-background-3: #321116;
  --scalar-border-color: #3c3031;

  --scalar-color-1: rgba(255, 255, 255, 0.9);
  --scalar-color-2: rgba(255, 255, 255, 0.62);
  --scalar-color-3: rgba(255, 255, 255, 0.44);

  --scalar-color-accent: rgba(255, 255, 255, 0.9);
  --scalar-background-accent: #441313;

  --scalar-code-language-color-supersede: var(--scalar-color-1);
}

/* Document Sidebar */
.light-mode .t-doc__sidebar,
.dark-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-border-color: var(--scalar-border-color);

  --scalar-sidebar-item-hover-color: currentColor;
  --scalar-sidebar-item-hover-background: var(--scalar-background-2);

  --scalar-sidebar-item-active-background: var(--scalar-background-3);
  --scalar-sidebar-color-active: var(--scalar-color-accent);

  --scalar-sidebar-search-background: rgba(255, 255, 255, 0.1);
  --scalar-sidebar-search-color: var(--scalar-color-3);
  --scalar-sidebar-search-border-color: var(--scalar-border-color);
  z-index: 1;
}
/* advanced */
.light-mode {
  --scalar-color-green: #09533a;
  --scalar-color-red: #aa181d;
  --scalar-color-yellow: #ab8d2b;
  --scalar-color-blue: #19689a;
  --scalar-color-orange: #b26c34;
  --scalar-color-purple: #4c2191;

  --scalar-button-1: rgba(0, 0, 0, 1);
  --scalar-button-1-hover: rgba(0, 0, 0, 0.8);
  --scalar-button-1-color: rgba(255, 255, 255, 0.9);
}
.dark-mode {
  --scalar-color-green: rgba(69, 255, 165, 0.823);
  --scalar-color-red: #ff8589;
  --scalar-color-yellow: #ffcc4d;
  --scalar-color-blue: #6bc1fe;
  --scalar-color-orange: #f98943;
  --scalar-color-purple: #b191f9;

  --scalar-button-1: rgba(255, 255, 255, 1);
  --scalar-button-1-hover: rgba(255, 255, 255, 0.9);
  --scalar-button-1-color: black;
}
/* Custom Theme */
.dark-mode h2.t-editor__heading,
.dark-mode .t-editor__page-title h1,
.dark-mode h1.section-header:not(::selection),
.dark-mode .markdown h1,
.dark-mode .markdown h2,
.dark-mode .markdown h3,
.dark-mode .markdown h4,
.dark-mode .markdown h5,
.dark-mode .markdown h6 {
  -webkit-text-fill-color: transparent;
  background-image: linear-gradient(to right bottom, rgb(255, 255, 255) 30%, rgba(255, 255, 255, 0.38));
  -webkit-background-clip: text;
  background-clip: text;
}
.light-mode .t-doc__sidebar {
  --scalar-sidebar-search-background: white;
}
.examples .scalar-card-footer {
  --scalar-background-3: transparent;
  padding-top: 0;
}
/* Hero section flare */
.section-flare {
  overflow-x: hidden;
  height: 100vh;
  left: initial;
}
.section-flare-item:nth-of-type(1) {
  background: #d25019;
  position: relative;
  top: -150px;
  right: -400px;
  width: 80vw;
  height: 500px;
  margin-top: -150px;
  border-radius: 50%;
  filter: blur(100px);
  z-index: 0;
}
.light-mode .section-flare {
  display: none;
}
*::selection {
  background-color: color-mix(in srgb, var(--scalar-color-red), transparent 75%);
}
`;var a3=`.light-mode {
  color-scheme: light;
  --scalar-color-1: #000000;
  --scalar-color-2: #000000;
  --scalar-color-3: #000000;
  --scalar-color-accent: #645b0f;
  --scalar-background-1: #ccc9b3;
  --scalar-background-2: #c2bfaa;
  --scalar-background-3: #b8b5a1;
  --scalar-background-accent: #000000;

  --scalar-border-color: rgba(0, 0, 0, 0.2);
  --scalar-scrollbar-color: rgba(0, 0, 0, 0.18);
  --scalar-scrollbar-color-active: rgba(0, 0, 0, 0.36);
  --scalar-lifted-brightness: 1;
  --scalar-backdrop-brightness: 1;

  --scalar-shadow-1: 0 1px 3px 0 rgba(0, 0, 0, 0.11);
  --scalar-shadow-2: rgba(0, 0, 0, 0.08) 0px 13px 20px 0px, rgba(0, 0, 0, 0.08) 0px 3px 8px 0px,
    var(--scalar-border-color) 0px 0 0 1px;

  --scalar-button-1: rgb(49 53 56);
  --scalar-button-1-color: #fff;
  --scalar-button-1-hover: rgb(28 31 33);

  --scalar-color-red: #b91c1c;
  --scalar-color-orange: #a16207;
  --scalar-color-green: #047857;
  --scalar-color-blue: #1d4ed8;
  --scalar-color-orange: #c2410c;
  --scalar-color-purple: #6d28d9;
}

.dark-mode {
  color-scheme: dark;
  --scalar-color-1: #fffef3;
  --scalar-color-2: #fffef3;
  --scalar-color-3: #fffef3;
  --scalar-color-accent: #c3b531;
  --scalar-background-1: #313332;
  --scalar-background-2: #393b3a;
  --scalar-background-3: #414342;
  --scalar-background-accent: #fffef3;

  --scalar-border-color: #505452;
  --scalar-scrollbar-color: rgba(255, 255, 255, 0.24);
  --scalar-scrollbar-color-active: rgba(255, 255, 255, 0.48);
  --scalar-lifted-brightness: 1.45;
  --scalar-backdrop-brightness: 0.5;

  --scalar-shadow-1: 0 1px 3px 0 rgba(0, 0, 0, 0.11);
  --scalar-shadow-2: rgba(15, 15, 15, 0.2) 0px 3px 6px, rgba(15, 15, 15, 0.4) 0px 9px 24px, 0 0 0 1px
    rgba(255, 255, 255, 0.1);

  --scalar-button-1: #f6f6f6;
  --scalar-button-1-color: #000;
  --scalar-button-1-hover: #e7e7e7;

  --scalar-color-green: #00b648;
  --scalar-color-red: #dc1b19;
  --scalar-color-yellow: #ffc90d;
  --scalar-color-blue: #4eb3ec;
  --scalar-color-orange: #ff8d4d;
  --scalar-color-purple: #b191f9;
}

/* Sidebar */
.light-mode .t-doc__sidebar,
.dark-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-border-color: var(--scalar-border-color);

  --scalar-sidebar-item-hover-background: var(--scalar-background-2);
  --scalar-sidebar-item-hover-color: currentColor;

  --scalar-sidebar-item-active-background: var(--scalar-background-3);
  --scalar-sidebar-color-active: var(--scalar-color-1);

  --scalar-sidebar-search-background: transparent;
  --scalar-sidebar-search-color: var(--scalar-color-3);
  --scalar-sidebar-search-border-color: var(--scalar-border-color);
}
*::selection {
  background-color: color-mix(in srgb, var(--scalar-color-accent), transparent 80%);
}
`;var u3=`/* basic theme */
.light-mode {
  --scalar-background-1: #fff;
  --scalar-background-2: #f5f6f8;
  --scalar-background-3: #eceef1;

  --scalar-color-1: #2a2f45;
  --scalar-color-2: #757575;
  --scalar-color-3: #8e8e8e;

  --scalar-color-accent: #5469d4;
  --scalar-background-accent: #5469d41f;

  --scalar-border-color: rgba(215, 215, 206, 0.68);
}
.dark-mode {
  --scalar-background-1: #15171c;
  --scalar-background-2: #1c1e24;
  --scalar-background-3: #22252b;

  --scalar-color-1: #fafafa;
  --scalar-color-2: #c9ced8;
  --scalar-color-3: #8c99ad;

  --scalar-color-accent: #5469d4;
  --scalar-background-accent: #5469d41f;

  --scalar-border-color: #3f4145;
}
/* Document Sidebar */
.light-mode .t-doc__sidebar,
.dark-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-border-color: var(--scalar-border-color);

  --scalar-sidebar-item-hover-color: currentColor;
  --scalar-sidebar-item-hover-background: var(--scalar-background-3);

  --scalar-sidebar-item-active-background: var(--scalar-background-accent);
  --scalar-sidebar-color-active: var(--scalar-color-accent);

  --scalar-sidebar-search-background: var(--scalar-background-1);
  --scalar-sidebar-search-color: var(--scalar-color-3);
  --scalar-sidebar-search-border-color: var(--scalar-border-color);
}

/* advanced */
.light-mode {
  --scalar-color-green: #17803d;
  --scalar-color-red: #e10909;
  --scalar-color-yellow: #edbe20;
  --scalar-color-blue: #1763a6;
  --scalar-color-orange: #e25b09;
  --scalar-color-purple: #5c3993;

  --scalar-button-1: rgba(0, 0, 0, 1);
  --scalar-button-1-hover: rgba(0, 0, 0, 0.8);
  --scalar-button-1-color: rgba(255, 255, 255, 0.9);
}
.dark-mode {
  --scalar-color-green: #30a159;
  --scalar-color-red: #dc1b19;
  --scalar-color-yellow: #eec644;
  --scalar-color-blue: #2b7abf;
  --scalar-color-orange: #f07528;
  --scalar-color-purple: #7a59b1;

  --scalar-button-1: rgba(255, 255, 255, 1);
  --scalar-button-1-hover: rgba(255, 255, 255, 0.9);
  --scalar-button-1-color: black;
}
.light-mode *::selection {
  background-color: color-mix(in srgb, var(--scalar-color-accent), transparent 70%);
}
.dark-mode *::selection {
  background-color: color-mix(in srgb, var(--scalar-color-accent), transparent 50%);
}
`;var p3=`/* basic theme */
.light-mode {
  --scalar-background-1: #f3f3ee;
  --scalar-background-2: #e8e8e3;
  --scalar-background-3: #e4e4df;
  --scalar-border-color: rgba(215, 215, 206, 0.85);

  --scalar-color-1: #2a2f45;
  --scalar-color-2: #757575;
  --scalar-color-3: #8e8e8e;

  --scalar-color-accent: #1763a6;
  --scalar-background-accent: #1f648e1f;
}
.dark-mode {
  --scalar-background-1: #09090b;
  --scalar-background-2: #18181b;
  --scalar-background-3: #2c2c30;
  --scalar-border-color: rgba(255, 255, 255, 0.17);

  --scalar-color-1: #fafafa;
  --scalar-color-2: rgb(161, 161, 170);
  --scalar-color-3: rgba(255, 255, 255, 0.533);

  --scalar-color-accent: #4eb3ec;
  --scalar-background-accent: #8ab4f81f;
}
/* Document Sidebar */
.light-mode .t-doc__sidebar,
.dark-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-border-color: var(--scalar-border-color);

  --scalar-sidebar-item-hover-background: var(--scalar-background-2);
  --scalar-sidebar-item-hover-color: currentColor;

  --scalar-sidebar-item-active-background: var(--scalar-background-3);
  --scalar-sidebar-color-active: var(--scalar-color-1);

  --scalar-sidebar-search-background: var(--scalar-background-1);
  --scalar-sidebar-search-border-color: var(--scalar-border-color);
  --scalar-sidebar-search-color: var(--scalar-color-3);
}

/* advanced */
.light-mode {
  --scalar-color-green: #17803d;
  --scalar-color-red: #e10909;
  --scalar-color-yellow: #edbe20;
  --scalar-color-blue: #1763a6;
  --scalar-color-orange: #e25b09;
  --scalar-color-purple: #5c3993;

  --scalar-button-1: rgba(0, 0, 0, 1);
  --scalar-button-1-hover: rgba(0, 0, 0, 0.8);
  --scalar-button-1-color: rgba(255, 255, 255, 0.9);
}
.dark-mode {
  --scalar-color-green: #30a159;
  --scalar-color-red: #dc1b19;
  --scalar-color-yellow: #eec644;
  --scalar-color-blue: #2b7abf;
  --scalar-color-orange: #f07528;
  --scalar-color-purple: #7a59b1;

  --scalar-button-1: rgba(255, 255, 255, 1);
  --scalar-button-1-hover: rgba(255, 255, 255, 0.9);
  --scalar-button-1-color: black;
}
.dark-mode h2.t-editor__heading,
.dark-mode .t-editor__page-title h1,
.dark-mode h1.section-header:not(::selection),
.dark-mode .markdown h1,
.dark-mode .markdown h2,
.dark-mode .markdown h3,
.dark-mode .markdown h4,
.dark-mode .markdown h5,
.dark-mode .markdown h6 {
  -webkit-text-fill-color: transparent;
  background-image: linear-gradient(to right bottom, rgb(255, 255, 255) 30%, rgba(255, 255, 255, 0.38));
  -webkit-background-clip: text;
  background-clip: text;
}
.light-mode *::selection {
  background-color: color-mix(in srgb, var(--scalar-color-accent), transparent 70%);
}
.dark-mode *::selection {
  background-color: color-mix(in srgb, var(--scalar-color-accent), transparent 50%);
}
`;var o3=`.light-mode {
  color-scheme: light;
  --scalar-color-1: #584c27;
  --scalar-color-2: #616161;
  --scalar-color-3: #a89f84;
  --scalar-color-accent: #b58900;
  --scalar-background-1: #fdf6e3;
  --scalar-background-2: #eee8d5;
  --scalar-background-3: #ddd6c1;
  --scalar-background-accent: #b589001f;

  --scalar-border-color: #ded8c8;
  --scalar-scrollbar-color: rgba(0, 0, 0, 0.18);
  --scalar-scrollbar-color-active: rgba(0, 0, 0, 0.36);
  --scalar-lifted-brightness: 1;
  --scalar-backdrop-brightness: 1;

  --scalar-shadow-1: 0 1px 3px 0 rgba(0, 0, 0, 0.11);
  --scalar-shadow-2: rgba(0, 0, 0, 0.08) 0px 13px 20px 0px, rgba(0, 0, 0, 0.08) 0px 3px 8px 0px, #eeeeed 0px 0 0 1px;

  --scalar-button-1: rgb(49 53 56);
  --scalar-button-1-color: #fff;
  --scalar-button-1-hover: rgb(28 31 33);

  --scalar-color-red: #b91c1c;
  --scalar-color-orange: #a16207;
  --scalar-color-green: #047857;
  --scalar-color-blue: #1d4ed8;
  --scalar-color-orange: #c2410c;
  --scalar-color-purple: #6d28d9;
}

.dark-mode {
  color-scheme: dark;
  --scalar-color-1: #fff;
  --scalar-color-2: #cccccc;
  --scalar-color-3: #6d8890;
  --scalar-color-accent: #007acc;
  --scalar-background-1: #00212b;
  --scalar-background-2: #012b36;
  --scalar-background-3: #004052;
  --scalar-background-accent: #015a6f;

  --scalar-border-color: #2f4851;
  --scalar-scrollbar-color: rgba(255, 255, 255, 0.24);
  --scalar-scrollbar-color-active: rgba(255, 255, 255, 0.48);
  --scalar-lifted-brightness: 1.45;
  --scalar-backdrop-brightness: 0.5;

  --scalar-shadow-1: 0 1px 3px 0 rgb(0, 0, 0, 0.1);
  --scalar-shadow-2: rgba(15, 15, 15, 0.2) 0px 3px 6px, rgba(15, 15, 15, 0.4) 0px 9px 24px, 0 0 0 1px
    rgba(255, 255, 255, 0.1);

  --scalar-button-1: #f6f6f6;
  --scalar-button-1-color: #000;
  --scalar-button-1-hover: #e7e7e7;

  --scalar-color-green: #00b648;
  --scalar-color-red: #dc1b19;
  --scalar-color-yellow: #ffc90d;
  --scalar-color-blue: #4eb3ec;
  --scalar-color-orange: #ff8d4d;
  --scalar-color-purple: #b191f9;
}

/* Sidebar */
.light-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-item-hover-color: currentColor;
  --scalar-sidebar-item-hover-background: var(--scalar-background-2);
  --scalar-sidebar-item-active-background: var(--scalar-background-accent);
  --scalar-sidebar-border-color: var(--scalar-border-color);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-color-active: var(--scalar-color-accent);
  --scalar-sidebar-search-background: var(--scalar-background-2);
  --scalar-sidebar-search-border-color: var(--scalar-sidebar-search-background);
  --scalar-sidebar-search--color: var(--scalar-color-3);
}

.dark-mode .sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-item-hover-color: currentColor;
  --scalar-sidebar-item-hover-background: var(--scalar-background-2);
  --scalar-sidebar-item-active-background: var(--scalar-background-accent);
  --scalar-sidebar-border-color: var(--scalar-border-color);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-color-active: var(--scalar-sidebar-color-1);
  --scalar-sidebar-search-background: var(--scalar-background-2);
  --scalar-sidebar-search-border-color: var(--scalar-sidebar-search-background);
  --scalar-sidebar-search--color: var(--scalar-color-3);
}
*::selection {
  background-color: color-mix(in srgb, var(--scalar-color-accent), transparent 70%);
}
`;var Y={};K6(Y,{void:()=>Q7,util:()=>E,unknown:()=>X7,union:()=>q7,undefined:()=>J7,tuple:()=>M7,transformer:()=>O7,symbol:()=>U7,string:()=>Ub,strictObject:()=>j7,setErrorMap:()=>E6,set:()=>c7,record:()=>N7,quotelessJson:()=>O6,promise:()=>D7,preprocess:()=>C7,pipeline:()=>k7,ostring:()=>P7,optional:()=>F7,onumber:()=>I7,oboolean:()=>T7,objectUtil:()=>o2,object:()=>H7,number:()=>Jb,nullable:()=>E7,null:()=>W7,never:()=>G7,nativeEnum:()=>K7,nan:()=>b7,map:()=>A7,makeIssue:()=>B1,literal:()=>B7,lazy:()=>V7,late:()=>t6,isValid:()=>K0,isDirty:()=>b2,isAsync:()=>s0,isAborted:()=>e1,intersection:()=>R7,instanceof:()=>e6,getParsedType:()=>j0,getErrorMap:()=>i0,function:()=>L7,enum:()=>S7,effect:()=>O7,discriminatedUnion:()=>z7,defaultErrorMap:()=>A0,datetimeRegex:()=>bb,date:()=>$7,custom:()=>$b,coerce:()=>v7,boolean:()=>Wb,bigint:()=>w7,array:()=>Y7,any:()=>_7,addIssueToContext:()=>R,ZodVoid:()=>K1,ZodUnknown:()=>D0,ZodUnion:()=>U1,ZodUndefined:()=>w1,ZodType:()=>F,ZodTuple:()=>z0,ZodTransformer:()=>Y0,ZodSymbol:()=>S1,ZodString:()=>_0,ZodSet:()=>Z0,ZodSchema:()=>F,ZodRecord:()=>D1,ZodReadonly:()=>Y1,ZodPromise:()=>g0,ZodPipeline:()=>E1,ZodParsedType:()=>q,ZodOptional:()=>G0,ZodObject:()=>I,ZodNumber:()=>O0,ZodNullable:()=>L0,ZodNull:()=>$1,ZodNever:()=>q0,ZodNativeEnum:()=>X1,ZodNaN:()=>F1,ZodMap:()=>O1,ZodLiteral:()=>_1,ZodLazy:()=>W1,ZodIssueCode:()=>j,ZodIntersection:()=>J1,ZodFunction:()=>e0,ZodFirstPartyTypeKind:()=>V,ZodError:()=>o,ZodEnum:()=>E0,ZodEffects:()=>Y0,ZodDiscriminatedUnion:()=>w2,ZodDefault:()=>G1,ZodDate:()=>x0,ZodCatch:()=>Q1,ZodBranded:()=>$2,ZodBoolean:()=>b1,ZodBigInt:()=>F0,ZodArray:()=>X0,ZodAny:()=>f0,Schema:()=>F,ParseStatus:()=>r,OK:()=>a,NEVER:()=>l7,INVALID:()=>c,EMPTY_PATH:()=>C6,DIRTY:()=>h0,BRAND:()=>s6});var E;(function(b){b.assertEqual=(J)=>{};function w(J){}b.assertIs=w;function $(J){throw new Error}b.assertNever=$,b.arrayToEnum=(J)=>{let W={};for(let _ of J)W[_]=_;return W},b.getValidEnumValues=(J)=>{let W=b.objectKeys(J).filter((X)=>typeof J[J[X]]!=="number"),_={};for(let X of W)_[X]=J[X];return b.objectValues(_)},b.objectValues=(J)=>{return b.objectKeys(J).map(function(W){return J[W]})},b.objectKeys=typeof Object.keys==="function"?(J)=>Object.keys(J):(J)=>{let W=[];for(let _ in J)if(Object.prototype.hasOwnProperty.call(J,_))W.push(_);return W},b.find=(J,W)=>{for(let _ of J)if(W(_))return _;return},b.isInteger=typeof Number.isInteger==="function"?(J)=>Number.isInteger(J):(J)=>typeof J==="number"&&Number.isFinite(J)&&Math.floor(J)===J;function U(J,W=" | "){return J.map((_)=>typeof _==="string"?`'${_}'`:_).join(W)}b.joinValues=U,b.jsonStringifyReplacer=(J,W)=>{if(typeof W==="bigint")return W.toString();return W}})(E||(E={}));var o2;(function(b){b.mergeShapes=(w,$)=>{return{...w,...$}}})(o2||(o2={}));var q=E.arrayToEnum(["string","nan","number","integer","float","boolean","date","bigint","symbol","function","undefined","null","array","object","unknown","promise","void","never","map","set"]),j0=(b)=>{switch(typeof b){case"undefined":return q.undefined;case"string":return q.string;case"number":return Number.isNaN(b)?q.nan:q.number;case"boolean":return q.boolean;case"function":return q.function;case"bigint":return q.bigint;case"symbol":return q.symbol;case"object":if(Array.isArray(b))return q.array;if(b===null)return q.null;if(b.then&&typeof b.then==="function"&&b.catch&&typeof b.catch==="function")return q.promise;if(typeof Map!=="undefined"&&b instanceof Map)return q.map;if(typeof Set!=="undefined"&&b instanceof Set)return q.set;if(typeof Date!=="undefined"&&b instanceof Date)return q.date;return q.object;default:return q.unknown}};var j=E.arrayToEnum(["invalid_type","invalid_literal","custom","invalid_union","invalid_union_discriminator","invalid_enum_value","unrecognized_keys","invalid_arguments","invalid_return_type","invalid_date","invalid_string","too_small","too_big","invalid_intersection_types","not_multiple_of","not_finite"]),O6=(b)=>{return JSON.stringify(b,null,2).replace(/"([^"]+)":/g,"$1:")};class o extends Error{get errors(){return this.issues}constructor(b){super();this.issues=[],this.addIssue=($)=>{this.issues=[...this.issues,$]},this.addIssues=($=[])=>{this.issues=[...this.issues,...$]};let w=new.target.prototype;if(Object.setPrototypeOf)Object.setPrototypeOf(this,w);else this.__proto__=w;this.name="ZodError",this.issues=b}format(b){let w=b||function(J){return J.message},$={_errors:[]},U=(J)=>{for(let W of J.issues)if(W.code==="invalid_union")W.unionErrors.map(U);else if(W.code==="invalid_return_type")U(W.returnTypeError);else if(W.code==="invalid_arguments")U(W.argumentsError);else if(W.path.length===0)$._errors.push(w(W));else{let _=$,X=0;while(X<W.path.length){let G=W.path[X];if(X!==W.path.length-1)_[G]=_[G]||{_errors:[]};else _[G]=_[G]||{_errors:[]},_[G]._errors.push(w(W));_=_[G],X++}}};return U(this),$}static assert(b){if(!(b instanceof o))throw new Error(`Not a ZodError: ${b}`)}toString(){return this.message}get message(){return JSON.stringify(this.issues,E.jsonStringifyReplacer,2)}get isEmpty(){return this.issues.length===0}flatten(b=(w)=>w.message){let w={},$=[];for(let U of this.issues)if(U.path.length>0)w[U.path[0]]=w[U.path[0]]||[],w[U.path[0]].push(b(U));else $.push(b(U));return{formErrors:$,fieldErrors:w}}get formErrors(){return this.flatten()}}o.create=(b)=>{return new o(b)};var F6=(b,w)=>{let $;switch(b.code){case j.invalid_type:if(b.received===q.undefined)$="Required";else $=`Expected ${b.expected}, received ${b.received}`;break;case j.invalid_literal:$=`Invalid literal value, expected ${JSON.stringify(b.expected,E.jsonStringifyReplacer)}`;break;case j.unrecognized_keys:$=`Unrecognized key(s) in object: ${E.joinValues(b.keys,", ")}`;break;case j.invalid_union:$="Invalid input";break;case j.invalid_union_discriminator:$=`Invalid discriminator value. Expected ${E.joinValues(b.options)}`;break;case j.invalid_enum_value:$=`Invalid enum value. Expected ${E.joinValues(b.options)}, received '${b.received}'`;break;case j.invalid_arguments:$="Invalid function arguments";break;case j.invalid_return_type:$="Invalid function return type";break;case j.invalid_date:$="Invalid date";break;case j.invalid_string:if(typeof b.validation==="object")if("includes"in b.validation){if($=`Invalid input: must include "${b.validation.includes}"`,typeof b.validation.position==="number")$=`${$} at one or more positions greater than or equal to ${b.validation.position}`}else if("startsWith"in b.validation)$=`Invalid input: must start with "${b.validation.startsWith}"`;else if("endsWith"in b.validation)$=`Invalid input: must end with "${b.validation.endsWith}"`;else E.assertNever(b.validation);else if(b.validation!=="regex")$=`Invalid ${b.validation}`;else $="Invalid";break;case j.too_small:if(b.type==="array")$=`Array must contain ${b.exact?"exactly":b.inclusive?"at least":"more than"} ${b.minimum} element(s)`;else if(b.type==="string")$=`String must contain ${b.exact?"exactly":b.inclusive?"at least":"over"} ${b.minimum} character(s)`;else if(b.type==="number")$=`Number must be ${b.exact?"exactly equal to ":b.inclusive?"greater than or equal to ":"greater than "}${b.minimum}`;else if(b.type==="date")$=`Date must be ${b.exact?"exactly equal to ":b.inclusive?"greater than or equal to ":"greater than "}${new Date(Number(b.minimum))}`;else $="Invalid input";break;case j.too_big:if(b.type==="array")$=`Array must contain ${b.exact?"exactly":b.inclusive?"at most":"less than"} ${b.maximum} element(s)`;else if(b.type==="string")$=`String must contain ${b.exact?"exactly":b.inclusive?"at most":"under"} ${b.maximum} character(s)`;else if(b.type==="number")$=`Number must be ${b.exact?"exactly":b.inclusive?"less than or equal to":"less than"} ${b.maximum}`;else if(b.type==="bigint")$=`BigInt must be ${b.exact?"exactly":b.inclusive?"less than or equal to":"less than"} ${b.maximum}`;else if(b.type==="date")$=`Date must be ${b.exact?"exactly":b.inclusive?"smaller than or equal to":"smaller than"} ${new Date(Number(b.maximum))}`;else $="Invalid input";break;case j.custom:$="Invalid input";break;case j.invalid_intersection_types:$="Intersection results could not be merged";break;case j.not_multiple_of:$=`Number must be a multiple of ${b.multipleOf}`;break;case j.not_finite:$="Number must be finite";break;default:$=w.defaultError,E.assertNever(b)}return{message:$}},A0=F6;var n3=A0;function E6(b){n3=b}function i0(){return n3}var B1=(b)=>{let{data:w,path:$,errorMaps:U,issueData:J}=b,W=[...$,...J.path||[]],_={...J,path:W};if(J.message!==void 0)return{...J,path:W,message:J.message};let X="",G=U.filter((Q)=>!!Q).slice().reverse();for(let Q of G)X=Q(_,{data:w,defaultError:X}).message;return{...J,path:W,message:X}},C6=[];function R(b,w){let $=i0(),U=B1({issueData:w,data:b.data,path:b.path,errorMaps:[b.common.contextualErrorMap,b.schemaErrorMap,$,$===A0?void 0:A0].filter((J)=>!!J)});b.common.issues.push(U)}class r{constructor(){this.value="valid"}dirty(){if(this.value==="valid")this.value="dirty"}abort(){if(this.value!=="aborted")this.value="aborted"}static mergeArray(b,w){let $=[];for(let U of w){if(U.status==="aborted")return c;if(U.status==="dirty")b.dirty();$.push(U.value)}return{status:b.value,value:$}}static async mergeObjectAsync(b,w){let $=[];for(let U of w){let J=await U.key,W=await U.value;$.push({key:J,value:W})}return r.mergeObjectSync(b,$)}static mergeObjectSync(b,w){let $={};for(let U of w){let{key:J,value:W}=U;if(J.status==="aborted")return c;if(W.status==="aborted")return c;if(J.status==="dirty")b.dirty();if(W.status==="dirty")b.dirty();if(J.value!=="__proto__"&&(typeof W.value!=="undefined"||U.alwaysSet))$[J.value]=W.value}return{status:b.value,value:$}}}var c=Object.freeze({status:"aborted"}),h0=(b)=>({status:"dirty",value:b}),a=(b)=>({status:"valid",value:b}),e1=(b)=>b.status==="aborted",b2=(b)=>b.status==="dirty",K0=(b)=>b.status==="valid",s0=(b)=>typeof Promise!=="undefined"&&b instanceof Promise;var A;(function(b){b.errToObj=(w)=>typeof w==="string"?{message:w}:w||{},b.toString=(w)=>typeof w==="string"?w:w?.message})(A||(A={}));class Q0{constructor(b,w,$,U){this._cachedPath=[],this.parent=b,this.data=w,this._path=$,this._key=U}get path(){if(!this._cachedPath.length)if(Array.isArray(this._key))this._cachedPath.push(...this._path,...this._key);else this._cachedPath.push(...this._path,this._key);return this._cachedPath}}var i3=(b,w)=>{if(K0(w))return{success:!0,data:w.value};else{if(!b.common.issues.length)throw new Error("Validation failed but no issues detected.");return{success:!1,get error(){if(this._error)return this._error;let $=new o(b.common.issues);return this._error=$,this._error}}}};function D(b){if(!b)return{};let{errorMap:w,invalid_type_error:$,required_error:U,description:J}=b;if(w&&($||U))throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);if(w)return{errorMap:w,description:J};return{errorMap:(_,X)=>{let{message:G}=b;if(_.code==="invalid_enum_value")return{message:G??X.defaultError};if(typeof X.data==="undefined")return{message:G??U??X.defaultError};if(_.code!=="invalid_type")return{message:X.defaultError};return{message:G??$??X.defaultError}},description:J}}class F{get description(){return this._def.description}_getType(b){return j0(b.data)}_getOrReturnCtx(b,w){return w||{common:b.parent.common,data:b.data,parsedType:j0(b.data),schemaErrorMap:this._def.errorMap,path:b.path,parent:b.parent}}_processInputParams(b){return{status:new r,ctx:{common:b.parent.common,data:b.data,parsedType:j0(b.data),schemaErrorMap:this._def.errorMap,path:b.path,parent:b.parent}}}_parseSync(b){let w=this._parse(b);if(s0(w))throw new Error("Synchronous parse encountered promise.");return w}_parseAsync(b){let w=this._parse(b);return Promise.resolve(w)}parse(b,w){let $=this.safeParse(b,w);if($.success)return $.data;throw $.error}safeParse(b,w){let $={common:{issues:[],async:w?.async??!1,contextualErrorMap:w?.errorMap},path:w?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:b,parsedType:j0(b)},U=this._parseSync({data:b,path:$.path,parent:$});return i3($,U)}"~validate"(b){let w={common:{issues:[],async:!!this["~standard"].async},path:[],schemaErrorMap:this._def.errorMap,parent:null,data:b,parsedType:j0(b)};if(!this["~standard"].async)try{let $=this._parseSync({data:b,path:[],parent:w});return K0($)?{value:$.value}:{issues:w.common.issues}}catch($){if($?.message?.toLowerCase()?.includes("encountered"))this["~standard"].async=!0;w.common={issues:[],async:!0}}return this._parseAsync({data:b,path:[],parent:w}).then(($)=>K0($)?{value:$.value}:{issues:w.common.issues})}async parseAsync(b,w){let $=await this.safeParseAsync(b,w);if($.success)return $.data;throw $.error}async safeParseAsync(b,w){let $={common:{issues:[],contextualErrorMap:w?.errorMap,async:!0},path:w?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:b,parsedType:j0(b)},U=this._parse({data:b,path:$.path,parent:$}),J=await(s0(U)?U:Promise.resolve(U));return i3($,J)}refine(b,w){let $=(U)=>{if(typeof w==="string"||typeof w==="undefined")return{message:w};else if(typeof w==="function")return w(U);else return w};return this._refinement((U,J)=>{let W=b(U),_=()=>J.addIssue({code:j.custom,...$(U)});if(typeof Promise!=="undefined"&&W instanceof Promise)return W.then((X)=>{if(!X)return _(),!1;else return!0});if(!W)return _(),!1;else return!0})}refinement(b,w){return this._refinement(($,U)=>{if(!b($))return U.addIssue(typeof w==="function"?w($,U):w),!1;else return!0})}_refinement(b){return new Y0({schema:this,typeName:V.ZodEffects,effect:{type:"refinement",refinement:b}})}superRefine(b){return this._refinement(b)}constructor(b){this.spa=this.safeParseAsync,this._def=b,this.parse=this.parse.bind(this),this.safeParse=this.safeParse.bind(this),this.parseAsync=this.parseAsync.bind(this),this.safeParseAsync=this.safeParseAsync.bind(this),this.spa=this.spa.bind(this),this.refine=this.refine.bind(this),this.refinement=this.refinement.bind(this),this.superRefine=this.superRefine.bind(this),this.optional=this.optional.bind(this),this.nullable=this.nullable.bind(this),this.nullish=this.nullish.bind(this),this.array=this.array.bind(this),this.promise=this.promise.bind(this),this.or=this.or.bind(this),this.and=this.and.bind(this),this.transform=this.transform.bind(this),this.brand=this.brand.bind(this),this.default=this.default.bind(this),this.catch=this.catch.bind(this),this.describe=this.describe.bind(this),this.pipe=this.pipe.bind(this),this.readonly=this.readonly.bind(this),this.isNullable=this.isNullable.bind(this),this.isOptional=this.isOptional.bind(this),this["~standard"]={version:1,vendor:"zod",validate:(w)=>this["~validate"](w)}}optional(){return G0.create(this,this._def)}nullable(){return L0.create(this,this._def)}nullish(){return this.nullable().optional()}array(){return X0.create(this)}promise(){return g0.create(this,this._def)}or(b){return U1.create([this,b],this._def)}and(b){return J1.create(this,b,this._def)}transform(b){return new Y0({...D(this._def),schema:this,typeName:V.ZodEffects,effect:{type:"transform",transform:b}})}default(b){let w=typeof b==="function"?b:()=>b;return new G1({...D(this._def),innerType:this,defaultValue:w,typeName:V.ZodDefault})}brand(){return new $2({typeName:V.ZodBranded,type:this,...D(this._def)})}catch(b){let w=typeof b==="function"?b:()=>b;return new Q1({...D(this._def),innerType:this,catchValue:w,typeName:V.ZodCatch})}describe(b){return new this.constructor({...this._def,description:b})}pipe(b){return E1.create(this,b)}readonly(){return Y1.create(this)}isOptional(){return this.safeParse(void 0).success}isNullable(){return this.safeParse(null).success}}var k6=/^c[^\s-]{8,}$/i,P6=/^[0-9a-z]+$/,I6=/^[0-9A-HJKMNP-TV-Z]{26}$/i,T6=/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,v6=/^[a-z0-9_-]{21}$/i,l6=/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,h6=/^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/,x6=/^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i,f6="^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$",n2,Z6=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,g6=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,m6=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,r6=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,y6=/^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,d6=/^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,t3="((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))",a6=new RegExp(`^${t3}$`);function e3(b){let w="[0-5]\\d";if(b.precision)w=`${w}\\.\\d{${b.precision}}`;else if(b.precision==null)w=`${w}(\\.\\d+)?`;let $=b.precision?"+":"?";return`([01]\\d|2[0-3]):[0-5]\\d(:${w})${$}`}function u6(b){return new RegExp(`^${e3(b)}$`)}function bb(b){let w=`${t3}T${e3(b)}`,$=[];if($.push(b.local?"Z?":"Z"),b.offset)$.push("([+-]\\d{2}:?\\d{2})");return w=`${w}(${$.join("|")})`,new RegExp(`^${w}$`)}function p6(b,w){if((w==="v4"||!w)&&Z6.test(b))return!0;if((w==="v6"||!w)&&m6.test(b))return!0;return!1}function o6(b,w){if(!l6.test(b))return!1;try{let[$]=b.split("."),U=$.replace(/-/g,"+").replace(/_/g,"/").padEnd($.length+(4-$.length%4)%4,"="),J=JSON.parse(atob(U));if(typeof J!=="object"||J===null)return!1;if("typ"in J&&J?.typ!=="JWT")return!1;if(!J.alg)return!1;if(w&&J.alg!==w)return!1;return!0}catch{return!1}}function n6(b,w){if((w==="v4"||!w)&&g6.test(b))return!0;if((w==="v6"||!w)&&r6.test(b))return!0;return!1}class _0 extends F{_parse(b){if(this._def.coerce)b.data=String(b.data);if(this._getType(b)!==q.string){let J=this._getOrReturnCtx(b);return R(J,{code:j.invalid_type,expected:q.string,received:J.parsedType}),c}let $=new r,U=void 0;for(let J of this._def.checks)if(J.kind==="min"){if(b.data.length<J.value)U=this._getOrReturnCtx(b,U),R(U,{code:j.too_small,minimum:J.value,type:"string",inclusive:!0,exact:!1,message:J.message}),$.dirty()}else if(J.kind==="max"){if(b.data.length>J.value)U=this._getOrReturnCtx(b,U),R(U,{code:j.too_big,maximum:J.value,type:"string",inclusive:!0,exact:!1,message:J.message}),$.dirty()}else if(J.kind==="length"){let W=b.data.length>J.value,_=b.data.length<J.value;if(W||_){if(U=this._getOrReturnCtx(b,U),W)R(U,{code:j.too_big,maximum:J.value,type:"string",inclusive:!0,exact:!0,message:J.message});else if(_)R(U,{code:j.too_small,minimum:J.value,type:"string",inclusive:!0,exact:!0,message:J.message});$.dirty()}}else if(J.kind==="email"){if(!x6.test(b.data))U=this._getOrReturnCtx(b,U),R(U,{validation:"email",code:j.invalid_string,message:J.message}),$.dirty()}else if(J.kind==="emoji"){if(!n2)n2=new RegExp(f6,"u");if(!n2.test(b.data))U=this._getOrReturnCtx(b,U),R(U,{validation:"emoji",code:j.invalid_string,message:J.message}),$.dirty()}else if(J.kind==="uuid"){if(!T6.test(b.data))U=this._getOrReturnCtx(b,U),R(U,{validation:"uuid",code:j.invalid_string,message:J.message}),$.dirty()}else if(J.kind==="nanoid"){if(!v6.test(b.data))U=this._getOrReturnCtx(b,U),R(U,{validation:"nanoid",code:j.invalid_string,message:J.message}),$.dirty()}else if(J.kind==="cuid"){if(!k6.test(b.data))U=this._getOrReturnCtx(b,U),R(U,{validation:"cuid",code:j.invalid_string,message:J.message}),$.dirty()}else if(J.kind==="cuid2"){if(!P6.test(b.data))U=this._getOrReturnCtx(b,U),R(U,{validation:"cuid2",code:j.invalid_string,message:J.message}),$.dirty()}else if(J.kind==="ulid"){if(!I6.test(b.data))U=this._getOrReturnCtx(b,U),R(U,{validation:"ulid",code:j.invalid_string,message:J.message}),$.dirty()}else if(J.kind==="url")try{new URL(b.data)}catch{U=this._getOrReturnCtx(b,U),R(U,{validation:"url",code:j.invalid_string,message:J.message}),$.dirty()}else if(J.kind==="regex"){if(J.regex.lastIndex=0,!J.regex.test(b.data))U=this._getOrReturnCtx(b,U),R(U,{validation:"regex",code:j.invalid_string,message:J.message}),$.dirty()}else if(J.kind==="trim")b.data=b.data.trim();else if(J.kind==="includes"){if(!b.data.includes(J.value,J.position))U=this._getOrReturnCtx(b,U),R(U,{code:j.invalid_string,validation:{includes:J.value,position:J.position},message:J.message}),$.dirty()}else if(J.kind==="toLowerCase")b.data=b.data.toLowerCase();else if(J.kind==="toUpperCase")b.data=b.data.toUpperCase();else if(J.kind==="startsWith"){if(!b.data.startsWith(J.value))U=this._getOrReturnCtx(b,U),R(U,{code:j.invalid_string,validation:{startsWith:J.value},message:J.message}),$.dirty()}else if(J.kind==="endsWith"){if(!b.data.endsWith(J.value))U=this._getOrReturnCtx(b,U),R(U,{code:j.invalid_string,validation:{endsWith:J.value},message:J.message}),$.dirty()}else if(J.kind==="datetime"){if(!bb(J).test(b.data))U=this._getOrReturnCtx(b,U),R(U,{code:j.invalid_string,validation:"datetime",message:J.message}),$.dirty()}else if(J.kind==="date"){if(!a6.test(b.data))U=this._getOrReturnCtx(b,U),R(U,{code:j.invalid_string,validation:"date",message:J.message}),$.dirty()}else if(J.kind==="time"){if(!u6(J).test(b.data))U=this._getOrReturnCtx(b,U),R(U,{code:j.invalid_string,validation:"time",message:J.message}),$.dirty()}else if(J.kind==="duration"){if(!h6.test(b.data))U=this._getOrReturnCtx(b,U),R(U,{validation:"duration",code:j.invalid_string,message:J.message}),$.dirty()}else if(J.kind==="ip"){if(!p6(b.data,J.version))U=this._getOrReturnCtx(b,U),R(U,{validation:"ip",code:j.invalid_string,message:J.message}),$.dirty()}else if(J.kind==="jwt"){if(!o6(b.data,J.alg))U=this._getOrReturnCtx(b,U),R(U,{validation:"jwt",code:j.invalid_string,message:J.message}),$.dirty()}else if(J.kind==="cidr"){if(!n6(b.data,J.version))U=this._getOrReturnCtx(b,U),R(U,{validation:"cidr",code:j.invalid_string,message:J.message}),$.dirty()}else if(J.kind==="base64"){if(!y6.test(b.data))U=this._getOrReturnCtx(b,U),R(U,{validation:"base64",code:j.invalid_string,message:J.message}),$.dirty()}else if(J.kind==="base64url"){if(!d6.test(b.data))U=this._getOrReturnCtx(b,U),R(U,{validation:"base64url",code:j.invalid_string,message:J.message}),$.dirty()}else E.assertNever(J);return{status:$.value,value:b.data}}_regex(b,w,$){return this.refinement((U)=>b.test(U),{validation:w,code:j.invalid_string,...A.errToObj($)})}_addCheck(b){return new _0({...this._def,checks:[...this._def.checks,b]})}email(b){return this._addCheck({kind:"email",...A.errToObj(b)})}url(b){return this._addCheck({kind:"url",...A.errToObj(b)})}emoji(b){return this._addCheck({kind:"emoji",...A.errToObj(b)})}uuid(b){return this._addCheck({kind:"uuid",...A.errToObj(b)})}nanoid(b){return this._addCheck({kind:"nanoid",...A.errToObj(b)})}cuid(b){return this._addCheck({kind:"cuid",...A.errToObj(b)})}cuid2(b){return this._addCheck({kind:"cuid2",...A.errToObj(b)})}ulid(b){return this._addCheck({kind:"ulid",...A.errToObj(b)})}base64(b){return this._addCheck({kind:"base64",...A.errToObj(b)})}base64url(b){return this._addCheck({kind:"base64url",...A.errToObj(b)})}jwt(b){return this._addCheck({kind:"jwt",...A.errToObj(b)})}ip(b){return this._addCheck({kind:"ip",...A.errToObj(b)})}cidr(b){return this._addCheck({kind:"cidr",...A.errToObj(b)})}datetime(b){if(typeof b==="string")return this._addCheck({kind:"datetime",precision:null,offset:!1,local:!1,message:b});return this._addCheck({kind:"datetime",precision:typeof b?.precision==="undefined"?null:b?.precision,offset:b?.offset??!1,local:b?.local??!1,...A.errToObj(b?.message)})}date(b){return this._addCheck({kind:"date",message:b})}time(b){if(typeof b==="string")return this._addCheck({kind:"time",precision:null,message:b});return this._addCheck({kind:"time",precision:typeof b?.precision==="undefined"?null:b?.precision,...A.errToObj(b?.message)})}duration(b){return this._addCheck({kind:"duration",...A.errToObj(b)})}regex(b,w){return this._addCheck({kind:"regex",regex:b,...A.errToObj(w)})}includes(b,w){return this._addCheck({kind:"includes",value:b,position:w?.position,...A.errToObj(w?.message)})}startsWith(b,w){return this._addCheck({kind:"startsWith",value:b,...A.errToObj(w)})}endsWith(b,w){return this._addCheck({kind:"endsWith",value:b,...A.errToObj(w)})}min(b,w){return this._addCheck({kind:"min",value:b,...A.errToObj(w)})}max(b,w){return this._addCheck({kind:"max",value:b,...A.errToObj(w)})}length(b,w){return this._addCheck({kind:"length",value:b,...A.errToObj(w)})}nonempty(b){return this.min(1,A.errToObj(b))}trim(){return new _0({...this._def,checks:[...this._def.checks,{kind:"trim"}]})}toLowerCase(){return new _0({...this._def,checks:[...this._def.checks,{kind:"toLowerCase"}]})}toUpperCase(){return new _0({...this._def,checks:[...this._def.checks,{kind:"toUpperCase"}]})}get isDatetime(){return!!this._def.checks.find((b)=>b.kind==="datetime")}get isDate(){return!!this._def.checks.find((b)=>b.kind==="date")}get isTime(){return!!this._def.checks.find((b)=>b.kind==="time")}get isDuration(){return!!this._def.checks.find((b)=>b.kind==="duration")}get isEmail(){return!!this._def.checks.find((b)=>b.kind==="email")}get isURL(){return!!this._def.checks.find((b)=>b.kind==="url")}get isEmoji(){return!!this._def.checks.find((b)=>b.kind==="emoji")}get isUUID(){return!!this._def.checks.find((b)=>b.kind==="uuid")}get isNANOID(){return!!this._def.checks.find((b)=>b.kind==="nanoid")}get isCUID(){return!!this._def.checks.find((b)=>b.kind==="cuid")}get isCUID2(){return!!this._def.checks.find((b)=>b.kind==="cuid2")}get isULID(){return!!this._def.checks.find((b)=>b.kind==="ulid")}get isIP(){return!!this._def.checks.find((b)=>b.kind==="ip")}get isCIDR(){return!!this._def.checks.find((b)=>b.kind==="cidr")}get isBase64(){return!!this._def.checks.find((b)=>b.kind==="base64")}get isBase64url(){return!!this._def.checks.find((b)=>b.kind==="base64url")}get minLength(){let b=null;for(let w of this._def.checks)if(w.kind==="min"){if(b===null||w.value>b)b=w.value}return b}get maxLength(){let b=null;for(let w of this._def.checks)if(w.kind==="max"){if(b===null||w.value<b)b=w.value}return b}}_0.create=(b)=>{return new _0({checks:[],typeName:V.ZodString,coerce:b?.coerce??!1,...D(b)})};function i6(b,w){let $=(b.toString().split(".")[1]||"").length,U=(w.toString().split(".")[1]||"").length,J=$>U?$:U,W=Number.parseInt(b.toFixed(J).replace(".","")),_=Number.parseInt(w.toFixed(J).replace(".",""));return W%_/10**J}class O0 extends F{constructor(){super(...arguments);this.min=this.gte,this.max=this.lte,this.step=this.multipleOf}_parse(b){if(this._def.coerce)b.data=Number(b.data);if(this._getType(b)!==q.number){let J=this._getOrReturnCtx(b);return R(J,{code:j.invalid_type,expected:q.number,received:J.parsedType}),c}let $=void 0,U=new r;for(let J of this._def.checks)if(J.kind==="int"){if(!E.isInteger(b.data))$=this._getOrReturnCtx(b,$),R($,{code:j.invalid_type,expected:"integer",received:"float",message:J.message}),U.dirty()}else if(J.kind==="min"){if(J.inclusive?b.data<J.value:b.data<=J.value)$=this._getOrReturnCtx(b,$),R($,{code:j.too_small,minimum:J.value,type:"number",inclusive:J.inclusive,exact:!1,message:J.message}),U.dirty()}else if(J.kind==="max"){if(J.inclusive?b.data>J.value:b.data>=J.value)$=this._getOrReturnCtx(b,$),R($,{code:j.too_big,maximum:J.value,type:"number",inclusive:J.inclusive,exact:!1,message:J.message}),U.dirty()}else if(J.kind==="multipleOf"){if(i6(b.data,J.value)!==0)$=this._getOrReturnCtx(b,$),R($,{code:j.not_multiple_of,multipleOf:J.value,message:J.message}),U.dirty()}else if(J.kind==="finite"){if(!Number.isFinite(b.data))$=this._getOrReturnCtx(b,$),R($,{code:j.not_finite,message:J.message}),U.dirty()}else E.assertNever(J);return{status:U.value,value:b.data}}gte(b,w){return this.setLimit("min",b,!0,A.toString(w))}gt(b,w){return this.setLimit("min",b,!1,A.toString(w))}lte(b,w){return this.setLimit("max",b,!0,A.toString(w))}lt(b,w){return this.setLimit("max",b,!1,A.toString(w))}setLimit(b,w,$,U){return new O0({...this._def,checks:[...this._def.checks,{kind:b,value:w,inclusive:$,message:A.toString(U)}]})}_addCheck(b){return new O0({...this._def,checks:[...this._def.checks,b]})}int(b){return this._addCheck({kind:"int",message:A.toString(b)})}positive(b){return this._addCheck({kind:"min",value:0,inclusive:!1,message:A.toString(b)})}negative(b){return this._addCheck({kind:"max",value:0,inclusive:!1,message:A.toString(b)})}nonpositive(b){return this._addCheck({kind:"max",value:0,inclusive:!0,message:A.toString(b)})}nonnegative(b){return this._addCheck({kind:"min",value:0,inclusive:!0,message:A.toString(b)})}multipleOf(b,w){return this._addCheck({kind:"multipleOf",value:b,message:A.toString(w)})}finite(b){return this._addCheck({kind:"finite",message:A.toString(b)})}safe(b){return this._addCheck({kind:"min",inclusive:!0,value:Number.MIN_SAFE_INTEGER,message:A.toString(b)})._addCheck({kind:"max",inclusive:!0,value:Number.MAX_SAFE_INTEGER,message:A.toString(b)})}get minValue(){let b=null;for(let w of this._def.checks)if(w.kind==="min"){if(b===null||w.value>b)b=w.value}return b}get maxValue(){let b=null;for(let w of this._def.checks)if(w.kind==="max"){if(b===null||w.value<b)b=w.value}return b}get isInt(){return!!this._def.checks.find((b)=>b.kind==="int"||b.kind==="multipleOf"&&E.isInteger(b.value))}get isFinite(){let b=null,w=null;for(let $ of this._def.checks)if($.kind==="finite"||$.kind==="int"||$.kind==="multipleOf")return!0;else if($.kind==="min"){if(w===null||$.value>w)w=$.value}else if($.kind==="max"){if(b===null||$.value<b)b=$.value}return Number.isFinite(w)&&Number.isFinite(b)}}O0.create=(b)=>{return new O0({checks:[],typeName:V.ZodNumber,coerce:b?.coerce||!1,...D(b)})};class F0 extends F{constructor(){super(...arguments);this.min=this.gte,this.max=this.lte}_parse(b){if(this._def.coerce)try{b.data=BigInt(b.data)}catch{return this._getInvalidInput(b)}if(this._getType(b)!==q.bigint)return this._getInvalidInput(b);let $=void 0,U=new r;for(let J of this._def.checks)if(J.kind==="min"){if(J.inclusive?b.data<J.value:b.data<=J.value)$=this._getOrReturnCtx(b,$),R($,{code:j.too_small,type:"bigint",minimum:J.value,inclusive:J.inclusive,message:J.message}),U.dirty()}else if(J.kind==="max"){if(J.inclusive?b.data>J.value:b.data>=J.value)$=this._getOrReturnCtx(b,$),R($,{code:j.too_big,type:"bigint",maximum:J.value,inclusive:J.inclusive,message:J.message}),U.dirty()}else if(J.kind==="multipleOf"){if(b.data%J.value!==BigInt(0))$=this._getOrReturnCtx(b,$),R($,{code:j.not_multiple_of,multipleOf:J.value,message:J.message}),U.dirty()}else E.assertNever(J);return{status:U.value,value:b.data}}_getInvalidInput(b){let w=this._getOrReturnCtx(b);return R(w,{code:j.invalid_type,expected:q.bigint,received:w.parsedType}),c}gte(b,w){return this.setLimit("min",b,!0,A.toString(w))}gt(b,w){return this.setLimit("min",b,!1,A.toString(w))}lte(b,w){return this.setLimit("max",b,!0,A.toString(w))}lt(b,w){return this.setLimit("max",b,!1,A.toString(w))}setLimit(b,w,$,U){return new F0({...this._def,checks:[...this._def.checks,{kind:b,value:w,inclusive:$,message:A.toString(U)}]})}_addCheck(b){return new F0({...this._def,checks:[...this._def.checks,b]})}positive(b){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!1,message:A.toString(b)})}negative(b){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!1,message:A.toString(b)})}nonpositive(b){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!0,message:A.toString(b)})}nonnegative(b){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!0,message:A.toString(b)})}multipleOf(b,w){return this._addCheck({kind:"multipleOf",value:b,message:A.toString(w)})}get minValue(){let b=null;for(let w of this._def.checks)if(w.kind==="min"){if(b===null||w.value>b)b=w.value}return b}get maxValue(){let b=null;for(let w of this._def.checks)if(w.kind==="max"){if(b===null||w.value<b)b=w.value}return b}}F0.create=(b)=>{return new F0({checks:[],typeName:V.ZodBigInt,coerce:b?.coerce??!1,...D(b)})};class b1 extends F{_parse(b){if(this._def.coerce)b.data=Boolean(b.data);if(this._getType(b)!==q.boolean){let $=this._getOrReturnCtx(b);return R($,{code:j.invalid_type,expected:q.boolean,received:$.parsedType}),c}return a(b.data)}}b1.create=(b)=>{return new b1({typeName:V.ZodBoolean,coerce:b?.coerce||!1,...D(b)})};class x0 extends F{_parse(b){if(this._def.coerce)b.data=new Date(b.data);if(this._getType(b)!==q.date){let J=this._getOrReturnCtx(b);return R(J,{code:j.invalid_type,expected:q.date,received:J.parsedType}),c}if(Number.isNaN(b.data.getTime())){let J=this._getOrReturnCtx(b);return R(J,{code:j.invalid_date}),c}let $=new r,U=void 0;for(let J of this._def.checks)if(J.kind==="min"){if(b.data.getTime()<J.value)U=this._getOrReturnCtx(b,U),R(U,{code:j.too_small,message:J.message,inclusive:!0,exact:!1,minimum:J.value,type:"date"}),$.dirty()}else if(J.kind==="max"){if(b.data.getTime()>J.value)U=this._getOrReturnCtx(b,U),R(U,{code:j.too_big,message:J.message,inclusive:!0,exact:!1,maximum:J.value,type:"date"}),$.dirty()}else E.assertNever(J);return{status:$.value,value:new Date(b.data.getTime())}}_addCheck(b){return new x0({...this._def,checks:[...this._def.checks,b]})}min(b,w){return this._addCheck({kind:"min",value:b.getTime(),message:A.toString(w)})}max(b,w){return this._addCheck({kind:"max",value:b.getTime(),message:A.toString(w)})}get minDate(){let b=null;for(let w of this._def.checks)if(w.kind==="min"){if(b===null||w.value>b)b=w.value}return b!=null?new Date(b):null}get maxDate(){let b=null;for(let w of this._def.checks)if(w.kind==="max"){if(b===null||w.value<b)b=w.value}return b!=null?new Date(b):null}}x0.create=(b)=>{return new x0({checks:[],coerce:b?.coerce||!1,typeName:V.ZodDate,...D(b)})};class S1 extends F{_parse(b){if(this._getType(b)!==q.symbol){let $=this._getOrReturnCtx(b);return R($,{code:j.invalid_type,expected:q.symbol,received:$.parsedType}),c}return a(b.data)}}S1.create=(b)=>{return new S1({typeName:V.ZodSymbol,...D(b)})};class w1 extends F{_parse(b){if(this._getType(b)!==q.undefined){let $=this._getOrReturnCtx(b);return R($,{code:j.invalid_type,expected:q.undefined,received:$.parsedType}),c}return a(b.data)}}w1.create=(b)=>{return new w1({typeName:V.ZodUndefined,...D(b)})};class $1 extends F{_parse(b){if(this._getType(b)!==q.null){let $=this._getOrReturnCtx(b);return R($,{code:j.invalid_type,expected:q.null,received:$.parsedType}),c}return a(b.data)}}$1.create=(b)=>{return new $1({typeName:V.ZodNull,...D(b)})};class f0 extends F{constructor(){super(...arguments);this._any=!0}_parse(b){return a(b.data)}}f0.create=(b)=>{return new f0({typeName:V.ZodAny,...D(b)})};class D0 extends F{constructor(){super(...arguments);this._unknown=!0}_parse(b){return a(b.data)}}D0.create=(b)=>{return new D0({typeName:V.ZodUnknown,...D(b)})};class q0 extends F{_parse(b){let w=this._getOrReturnCtx(b);return R(w,{code:j.invalid_type,expected:q.never,received:w.parsedType}),c}}q0.create=(b)=>{return new q0({typeName:V.ZodNever,...D(b)})};class K1 extends F{_parse(b){if(this._getType(b)!==q.undefined){let $=this._getOrReturnCtx(b);return R($,{code:j.invalid_type,expected:q.void,received:$.parsedType}),c}return a(b.data)}}K1.create=(b)=>{return new K1({typeName:V.ZodVoid,...D(b)})};class X0 extends F{_parse(b){let{ctx:w,status:$}=this._processInputParams(b),U=this._def;if(w.parsedType!==q.array)return R(w,{code:j.invalid_type,expected:q.array,received:w.parsedType}),c;if(U.exactLength!==null){let W=w.data.length>U.exactLength.value,_=w.data.length<U.exactLength.value;if(W||_)R(w,{code:W?j.too_big:j.too_small,minimum:_?U.exactLength.value:void 0,maximum:W?U.exactLength.value:void 0,type:"array",inclusive:!0,exact:!0,message:U.exactLength.message}),$.dirty()}if(U.minLength!==null){if(w.data.length<U.minLength.value)R(w,{code:j.too_small,minimum:U.minLength.value,type:"array",inclusive:!0,exact:!1,message:U.minLength.message}),$.dirty()}if(U.maxLength!==null){if(w.data.length>U.maxLength.value)R(w,{code:j.too_big,maximum:U.maxLength.value,type:"array",inclusive:!0,exact:!1,message:U.maxLength.message}),$.dirty()}if(w.common.async)return Promise.all([...w.data].map((W,_)=>{return U.type._parseAsync(new Q0(w,W,w.path,_))})).then((W)=>{return r.mergeArray($,W)});let J=[...w.data].map((W,_)=>{return U.type._parseSync(new Q0(w,W,w.path,_))});return r.mergeArray($,J)}get element(){return this._def.type}min(b,w){return new X0({...this._def,minLength:{value:b,message:A.toString(w)}})}max(b,w){return new X0({...this._def,maxLength:{value:b,message:A.toString(w)}})}length(b,w){return new X0({...this._def,exactLength:{value:b,message:A.toString(w)}})}nonempty(b){return this.min(1,b)}}X0.create=(b,w)=>{return new X0({type:b,minLength:null,maxLength:null,exactLength:null,typeName:V.ZodArray,...D(w)})};function t0(b){if(b instanceof I){let w={};for(let $ in b.shape){let U=b.shape[$];w[$]=G0.create(t0(U))}return new I({...b._def,shape:()=>w})}else if(b instanceof X0)return new X0({...b._def,type:t0(b.element)});else if(b instanceof G0)return G0.create(t0(b.unwrap()));else if(b instanceof L0)return L0.create(t0(b.unwrap()));else if(b instanceof z0)return z0.create(b.items.map((w)=>t0(w)));else return b}class I extends F{constructor(){super(...arguments);this._cached=null,this.nonstrict=this.passthrough,this.augment=this.extend}_getCached(){if(this._cached!==null)return this._cached;let b=this._def.shape(),w=E.objectKeys(b);return this._cached={shape:b,keys:w},this._cached}_parse(b){if(this._getType(b)!==q.object){let G=this._getOrReturnCtx(b);return R(G,{code:j.invalid_type,expected:q.object,received:G.parsedType}),c}let{status:$,ctx:U}=this._processInputParams(b),{shape:J,keys:W}=this._getCached(),_=[];if(!(this._def.catchall instanceof q0&&this._def.unknownKeys==="strip")){for(let G in U.data)if(!W.includes(G))_.push(G)}let X=[];for(let G of W){let Q=J[G],H=U.data[G];X.push({key:{status:"valid",value:G},value:Q._parse(new Q0(U,H,U.path,G)),alwaysSet:G in U.data})}if(this._def.catchall instanceof q0){let G=this._def.unknownKeys;if(G==="passthrough")for(let Q of _)X.push({key:{status:"valid",value:Q},value:{status:"valid",value:U.data[Q]}});else if(G==="strict"){if(_.length>0)R(U,{code:j.unrecognized_keys,keys:_}),$.dirty()}else if(G==="strip");else throw new Error("Internal ZodObject error: invalid unknownKeys value.")}else{let G=this._def.catchall;for(let Q of _){let H=U.data[Q];X.push({key:{status:"valid",value:Q},value:G._parse(new Q0(U,H,U.path,Q)),alwaysSet:Q in U.data})}}if(U.common.async)return Promise.resolve().then(async()=>{let G=[];for(let Q of X){let H=await Q.key,z=await Q.value;G.push({key:H,value:z,alwaysSet:Q.alwaysSet})}return G}).then((G)=>{return r.mergeObjectSync($,G)});else return r.mergeObjectSync($,X)}get shape(){return this._def.shape()}strict(b){return A.errToObj,new I({...this._def,unknownKeys:"strict",...b!==void 0?{errorMap:(w,$)=>{let U=this._def.errorMap?.(w,$).message??$.defaultError;if(w.code==="unrecognized_keys")return{message:A.errToObj(b).message??U};return{message:U}}}:{}})}strip(){return new I({...this._def,unknownKeys:"strip"})}passthrough(){return new I({...this._def,unknownKeys:"passthrough"})}extend(b){return new I({...this._def,shape:()=>({...this._def.shape(),...b})})}merge(b){return new I({unknownKeys:b._def.unknownKeys,catchall:b._def.catchall,shape:()=>({...this._def.shape(),...b._def.shape()}),typeName:V.ZodObject})}setKey(b,w){return this.augment({[b]:w})}catchall(b){return new I({...this._def,catchall:b})}pick(b){let w={};for(let $ of E.objectKeys(b))if(b[$]&&this.shape[$])w[$]=this.shape[$];return new I({...this._def,shape:()=>w})}omit(b){let w={};for(let $ of E.objectKeys(this.shape))if(!b[$])w[$]=this.shape[$];return new I({...this._def,shape:()=>w})}deepPartial(){return t0(this)}partial(b){let w={};for(let $ of E.objectKeys(this.shape)){let U=this.shape[$];if(b&&!b[$])w[$]=U;else w[$]=U.optional()}return new I({...this._def,shape:()=>w})}required(b){let w={};for(let $ of E.objectKeys(this.shape))if(b&&!b[$])w[$]=this.shape[$];else{let J=this.shape[$];while(J instanceof G0)J=J._def.innerType;w[$]=J}return new I({...this._def,shape:()=>w})}keyof(){return wb(E.objectKeys(this.shape))}}I.create=(b,w)=>{return new I({shape:()=>b,unknownKeys:"strip",catchall:q0.create(),typeName:V.ZodObject,...D(w)})};I.strictCreate=(b,w)=>{return new I({shape:()=>b,unknownKeys:"strict",catchall:q0.create(),typeName:V.ZodObject,...D(w)})};I.lazycreate=(b,w)=>{return new I({shape:b,unknownKeys:"strip",catchall:q0.create(),typeName:V.ZodObject,...D(w)})};class U1 extends F{_parse(b){let{ctx:w}=this._processInputParams(b),$=this._def.options;function U(J){for(let _ of J)if(_.result.status==="valid")return _.result;for(let _ of J)if(_.result.status==="dirty")return w.common.issues.push(..._.ctx.common.issues),_.result;let W=J.map((_)=>new o(_.ctx.common.issues));return R(w,{code:j.invalid_union,unionErrors:W}),c}if(w.common.async)return Promise.all($.map(async(J)=>{let W={...w,common:{...w.common,issues:[]},parent:null};return{result:await J._parseAsync({data:w.data,path:w.path,parent:W}),ctx:W}})).then(U);else{let J=void 0,W=[];for(let X of $){let G={...w,common:{...w.common,issues:[]},parent:null},Q=X._parseSync({data:w.data,path:w.path,parent:G});if(Q.status==="valid")return Q;else if(Q.status==="dirty"&&!J)J={result:Q,ctx:G};if(G.common.issues.length)W.push(G.common.issues)}if(J)return w.common.issues.push(...J.ctx.common.issues),J.result;let _=W.map((X)=>new o(X));return R(w,{code:j.invalid_union,unionErrors:_}),c}}get options(){return this._def.options}}U1.create=(b,w)=>{return new U1({options:b,typeName:V.ZodUnion,...D(w)})};var c0=(b)=>{if(b instanceof W1)return c0(b.schema);else if(b instanceof Y0)return c0(b.innerType());else if(b instanceof _1)return[b.value];else if(b instanceof E0)return b.options;else if(b instanceof X1)return E.objectValues(b.enum);else if(b instanceof G1)return c0(b._def.innerType);else if(b instanceof w1)return[void 0];else if(b instanceof $1)return[null];else if(b instanceof G0)return[void 0,...c0(b.unwrap())];else if(b instanceof L0)return[null,...c0(b.unwrap())];else if(b instanceof $2)return c0(b.unwrap());else if(b instanceof Y1)return c0(b.unwrap());else if(b instanceof Q1)return c0(b._def.innerType);else return[]};class w2 extends F{_parse(b){let{ctx:w}=this._processInputParams(b);if(w.parsedType!==q.object)return R(w,{code:j.invalid_type,expected:q.object,received:w.parsedType}),c;let $=this.discriminator,U=w.data[$],J=this.optionsMap.get(U);if(!J)return R(w,{code:j.invalid_union_discriminator,options:Array.from(this.optionsMap.keys()),path:[$]}),c;if(w.common.async)return J._parseAsync({data:w.data,path:w.path,parent:w});else return J._parseSync({data:w.data,path:w.path,parent:w})}get discriminator(){return this._def.discriminator}get options(){return this._def.options}get optionsMap(){return this._def.optionsMap}static create(b,w,$){let U=new Map;for(let J of w){let W=c0(J.shape[b]);if(!W.length)throw new Error(`A discriminator value for key \`${b}\` could not be extracted from all schema options`);for(let _ of W){if(U.has(_))throw new Error(`Discriminator property ${String(b)} has duplicate value ${String(_)}`);U.set(_,J)}}return new w2({typeName:V.ZodDiscriminatedUnion,discriminator:b,options:w,optionsMap:U,...D($)})}}function i2(b,w){let $=j0(b),U=j0(w);if(b===w)return{valid:!0,data:b};else if($===q.object&&U===q.object){let J=E.objectKeys(w),W=E.objectKeys(b).filter((X)=>J.indexOf(X)!==-1),_={...b,...w};for(let X of W){let G=i2(b[X],w[X]);if(!G.valid)return{valid:!1};_[X]=G.data}return{valid:!0,data:_}}else if($===q.array&&U===q.array){if(b.length!==w.length)return{valid:!1};let J=[];for(let W=0;W<b.length;W++){let _=b[W],X=w[W],G=i2(_,X);if(!G.valid)return{valid:!1};J.push(G.data)}return{valid:!0,data:J}}else if($===q.date&&U===q.date&&+b===+w)return{valid:!0,data:b};else return{valid:!1}}class J1 extends F{_parse(b){let{status:w,ctx:$}=this._processInputParams(b),U=(J,W)=>{if(e1(J)||e1(W))return c;let _=i2(J.value,W.value);if(!_.valid)return R($,{code:j.invalid_intersection_types}),c;if(b2(J)||b2(W))w.dirty();return{status:w.value,value:_.data}};if($.common.async)return Promise.all([this._def.left._parseAsync({data:$.data,path:$.path,parent:$}),this._def.right._parseAsync({data:$.data,path:$.path,parent:$})]).then(([J,W])=>U(J,W));else return U(this._def.left._parseSync({data:$.data,path:$.path,parent:$}),this._def.right._parseSync({data:$.data,path:$.path,parent:$}))}}J1.create=(b,w,$)=>{return new J1({left:b,right:w,typeName:V.ZodIntersection,...D($)})};class z0 extends F{_parse(b){let{status:w,ctx:$}=this._processInputParams(b);if($.parsedType!==q.array)return R($,{code:j.invalid_type,expected:q.array,received:$.parsedType}),c;if($.data.length<this._def.items.length)return R($,{code:j.too_small,minimum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),c;if(!this._def.rest&&$.data.length>this._def.items.length)R($,{code:j.too_big,maximum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),w.dirty();let J=[...$.data].map((W,_)=>{let X=this._def.items[_]||this._def.rest;if(!X)return null;return X._parse(new Q0($,W,$.path,_))}).filter((W)=>!!W);if($.common.async)return Promise.all(J).then((W)=>{return r.mergeArray(w,W)});else return r.mergeArray(w,J)}get items(){return this._def.items}rest(b){return new z0({...this._def,rest:b})}}z0.create=(b,w)=>{if(!Array.isArray(b))throw new Error("You must pass an array of schemas to z.tuple([ ... ])");return new z0({items:b,typeName:V.ZodTuple,rest:null,...D(w)})};class D1 extends F{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(b){let{status:w,ctx:$}=this._processInputParams(b);if($.parsedType!==q.object)return R($,{code:j.invalid_type,expected:q.object,received:$.parsedType}),c;let U=[],J=this._def.keyType,W=this._def.valueType;for(let _ in $.data)U.push({key:J._parse(new Q0($,_,$.path,_)),value:W._parse(new Q0($,$.data[_],$.path,_)),alwaysSet:_ in $.data});if($.common.async)return r.mergeObjectAsync(w,U);else return r.mergeObjectSync(w,U)}get element(){return this._def.valueType}static create(b,w,$){if(w instanceof F)return new D1({keyType:b,valueType:w,typeName:V.ZodRecord,...D($)});return new D1({keyType:_0.create(),valueType:b,typeName:V.ZodRecord,...D(w)})}}class O1 extends F{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(b){let{status:w,ctx:$}=this._processInputParams(b);if($.parsedType!==q.map)return R($,{code:j.invalid_type,expected:q.map,received:$.parsedType}),c;let U=this._def.keyType,J=this._def.valueType,W=[...$.data.entries()].map(([_,X],G)=>{return{key:U._parse(new Q0($,_,$.path,[G,"key"])),value:J._parse(new Q0($,X,$.path,[G,"value"]))}});if($.common.async){let _=new Map;return Promise.resolve().then(async()=>{for(let X of W){let G=await X.key,Q=await X.value;if(G.status==="aborted"||Q.status==="aborted")return c;if(G.status==="dirty"||Q.status==="dirty")w.dirty();_.set(G.value,Q.value)}return{status:w.value,value:_}})}else{let _=new Map;for(let X of W){let{key:G,value:Q}=X;if(G.status==="aborted"||Q.status==="aborted")return c;if(G.status==="dirty"||Q.status==="dirty")w.dirty();_.set(G.value,Q.value)}return{status:w.value,value:_}}}}O1.create=(b,w,$)=>{return new O1({valueType:w,keyType:b,typeName:V.ZodMap,...D($)})};class Z0 extends F{_parse(b){let{status:w,ctx:$}=this._processInputParams(b);if($.parsedType!==q.set)return R($,{code:j.invalid_type,expected:q.set,received:$.parsedType}),c;let U=this._def;if(U.minSize!==null){if($.data.size<U.minSize.value)R($,{code:j.too_small,minimum:U.minSize.value,type:"set",inclusive:!0,exact:!1,message:U.minSize.message}),w.dirty()}if(U.maxSize!==null){if($.data.size>U.maxSize.value)R($,{code:j.too_big,maximum:U.maxSize.value,type:"set",inclusive:!0,exact:!1,message:U.maxSize.message}),w.dirty()}let J=this._def.valueType;function W(X){let G=new Set;for(let Q of X){if(Q.status==="aborted")return c;if(Q.status==="dirty")w.dirty();G.add(Q.value)}return{status:w.value,value:G}}let _=[...$.data.values()].map((X,G)=>J._parse(new Q0($,X,$.path,G)));if($.common.async)return Promise.all(_).then((X)=>W(X));else return W(_)}min(b,w){return new Z0({...this._def,minSize:{value:b,message:A.toString(w)}})}max(b,w){return new Z0({...this._def,maxSize:{value:b,message:A.toString(w)}})}size(b,w){return this.min(b,w).max(b,w)}nonempty(b){return this.min(1,b)}}Z0.create=(b,w)=>{return new Z0({valueType:b,minSize:null,maxSize:null,typeName:V.ZodSet,...D(w)})};class e0 extends F{constructor(){super(...arguments);this.validate=this.implement}_parse(b){let{ctx:w}=this._processInputParams(b);if(w.parsedType!==q.function)return R(w,{code:j.invalid_type,expected:q.function,received:w.parsedType}),c;function $(_,X){return B1({data:_,path:w.path,errorMaps:[w.common.contextualErrorMap,w.schemaErrorMap,i0(),A0].filter((G)=>!!G),issueData:{code:j.invalid_arguments,argumentsError:X}})}function U(_,X){return B1({data:_,path:w.path,errorMaps:[w.common.contextualErrorMap,w.schemaErrorMap,i0(),A0].filter((G)=>!!G),issueData:{code:j.invalid_return_type,returnTypeError:X}})}let J={errorMap:w.common.contextualErrorMap},W=w.data;if(this._def.returns instanceof g0){let _=this;return a(async function(...X){let G=new o([]),Q=await _._def.args.parseAsync(X,J).catch((N)=>{throw G.addIssue($(X,N)),G}),H=await Reflect.apply(W,this,Q);return await _._def.returns._def.type.parseAsync(H,J).catch((N)=>{throw G.addIssue(U(H,N)),G})})}else{let _=this;return a(function(...X){let G=_._def.args.safeParse(X,J);if(!G.success)throw new o([$(X,G.error)]);let Q=Reflect.apply(W,this,G.data),H=_._def.returns.safeParse(Q,J);if(!H.success)throw new o([U(Q,H.error)]);return H.data})}}parameters(){return this._def.args}returnType(){return this._def.returns}args(...b){return new e0({...this._def,args:z0.create(b).rest(D0.create())})}returns(b){return new e0({...this._def,returns:b})}implement(b){return this.parse(b)}strictImplement(b){return this.parse(b)}static create(b,w,$){return new e0({args:b?b:z0.create([]).rest(D0.create()),returns:w||D0.create(),typeName:V.ZodFunction,...D($)})}}class W1 extends F{get schema(){return this._def.getter()}_parse(b){let{ctx:w}=this._processInputParams(b);return this._def.getter()._parse({data:w.data,path:w.path,parent:w})}}W1.create=(b,w)=>{return new W1({getter:b,typeName:V.ZodLazy,...D(w)})};class _1 extends F{_parse(b){if(b.data!==this._def.value){let w=this._getOrReturnCtx(b);return R(w,{received:w.data,code:j.invalid_literal,expected:this._def.value}),c}return{status:"valid",value:b.data}}get value(){return this._def.value}}_1.create=(b,w)=>{return new _1({value:b,typeName:V.ZodLiteral,...D(w)})};function wb(b,w){return new E0({values:b,typeName:V.ZodEnum,...D(w)})}class E0 extends F{_parse(b){if(typeof b.data!=="string"){let w=this._getOrReturnCtx(b),$=this._def.values;return R(w,{expected:E.joinValues($),received:w.parsedType,code:j.invalid_type}),c}if(!this._cache)this._cache=new Set(this._def.values);if(!this._cache.has(b.data)){let w=this._getOrReturnCtx(b),$=this._def.values;return R(w,{received:w.data,code:j.invalid_enum_value,options:$}),c}return a(b.data)}get options(){return this._def.values}get enum(){let b={};for(let w of this._def.values)b[w]=w;return b}get Values(){let b={};for(let w of this._def.values)b[w]=w;return b}get Enum(){let b={};for(let w of this._def.values)b[w]=w;return b}extract(b,w=this._def){return E0.create(b,{...this._def,...w})}exclude(b,w=this._def){return E0.create(this.options.filter(($)=>!b.includes($)),{...this._def,...w})}}E0.create=wb;class X1 extends F{_parse(b){let w=E.getValidEnumValues(this._def.values),$=this._getOrReturnCtx(b);if($.parsedType!==q.string&&$.parsedType!==q.number){let U=E.objectValues(w);return R($,{expected:E.joinValues(U),received:$.parsedType,code:j.invalid_type}),c}if(!this._cache)this._cache=new Set(E.getValidEnumValues(this._def.values));if(!this._cache.has(b.data)){let U=E.objectValues(w);return R($,{received:$.data,code:j.invalid_enum_value,options:U}),c}return a(b.data)}get enum(){return this._def.values}}X1.create=(b,w)=>{return new X1({values:b,typeName:V.ZodNativeEnum,...D(w)})};class g0 extends F{unwrap(){return this._def.type}_parse(b){let{ctx:w}=this._processInputParams(b);if(w.parsedType!==q.promise&&w.common.async===!1)return R(w,{code:j.invalid_type,expected:q.promise,received:w.parsedType}),c;let $=w.parsedType===q.promise?w.data:Promise.resolve(w.data);return a($.then((U)=>{return this._def.type.parseAsync(U,{path:w.path,errorMap:w.common.contextualErrorMap})}))}}g0.create=(b,w)=>{return new g0({type:b,typeName:V.ZodPromise,...D(w)})};class Y0 extends F{innerType(){return this._def.schema}sourceType(){return this._def.schema._def.typeName===V.ZodEffects?this._def.schema.sourceType():this._def.schema}_parse(b){let{status:w,ctx:$}=this._processInputParams(b),U=this._def.effect||null,J={addIssue:(W)=>{if(R($,W),W.fatal)w.abort();else w.dirty()},get path(){return $.path}};if(J.addIssue=J.addIssue.bind(J),U.type==="preprocess"){let W=U.transform($.data,J);if($.common.async)return Promise.resolve(W).then(async(_)=>{if(w.value==="aborted")return c;let X=await this._def.schema._parseAsync({data:_,path:$.path,parent:$});if(X.status==="aborted")return c;if(X.status==="dirty")return h0(X.value);if(w.value==="dirty")return h0(X.value);return X});else{if(w.value==="aborted")return c;let _=this._def.schema._parseSync({data:W,path:$.path,parent:$});if(_.status==="aborted")return c;if(_.status==="dirty")return h0(_.value);if(w.value==="dirty")return h0(_.value);return _}}if(U.type==="refinement"){let W=(_)=>{let X=U.refinement(_,J);if($.common.async)return Promise.resolve(X);if(X instanceof Promise)throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");return _};if($.common.async===!1){let _=this._def.schema._parseSync({data:$.data,path:$.path,parent:$});if(_.status==="aborted")return c;if(_.status==="dirty")w.dirty();return W(_.value),{status:w.value,value:_.value}}else return this._def.schema._parseAsync({data:$.data,path:$.path,parent:$}).then((_)=>{if(_.status==="aborted")return c;if(_.status==="dirty")w.dirty();return W(_.value).then(()=>{return{status:w.value,value:_.value}})})}if(U.type==="transform")if($.common.async===!1){let W=this._def.schema._parseSync({data:$.data,path:$.path,parent:$});if(!K0(W))return c;let _=U.transform(W.value,J);if(_ instanceof Promise)throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");return{status:w.value,value:_}}else return this._def.schema._parseAsync({data:$.data,path:$.path,parent:$}).then((W)=>{if(!K0(W))return c;return Promise.resolve(U.transform(W.value,J)).then((_)=>({status:w.value,value:_}))});E.assertNever(U)}}Y0.create=(b,w,$)=>{return new Y0({schema:b,typeName:V.ZodEffects,effect:w,...D($)})};Y0.createWithPreprocess=(b,w,$)=>{return new Y0({schema:w,effect:{type:"preprocess",transform:b},typeName:V.ZodEffects,...D($)})};class G0 extends F{_parse(b){if(this._getType(b)===q.undefined)return a(void 0);return this._def.innerType._parse(b)}unwrap(){return this._def.innerType}}G0.create=(b,w)=>{return new G0({innerType:b,typeName:V.ZodOptional,...D(w)})};class L0 extends F{_parse(b){if(this._getType(b)===q.null)return a(null);return this._def.innerType._parse(b)}unwrap(){return this._def.innerType}}L0.create=(b,w)=>{return new L0({innerType:b,typeName:V.ZodNullable,...D(w)})};class G1 extends F{_parse(b){let{ctx:w}=this._processInputParams(b),$=w.data;if(w.parsedType===q.undefined)$=this._def.defaultValue();return this._def.innerType._parse({data:$,path:w.path,parent:w})}removeDefault(){return this._def.innerType}}G1.create=(b,w)=>{return new G1({innerType:b,typeName:V.ZodDefault,defaultValue:typeof w.default==="function"?w.default:()=>w.default,...D(w)})};class Q1 extends F{_parse(b){let{ctx:w}=this._processInputParams(b),$={...w,common:{...w.common,issues:[]}},U=this._def.innerType._parse({data:$.data,path:$.path,parent:{...$}});if(s0(U))return U.then((J)=>{return{status:"valid",value:J.status==="valid"?J.value:this._def.catchValue({get error(){return new o($.common.issues)},input:$.data})}});else return{status:"valid",value:U.status==="valid"?U.value:this._def.catchValue({get error(){return new o($.common.issues)},input:$.data})}}removeCatch(){return this._def.innerType}}Q1.create=(b,w)=>{return new Q1({innerType:b,typeName:V.ZodCatch,catchValue:typeof w.catch==="function"?w.catch:()=>w.catch,...D(w)})};class F1 extends F{_parse(b){if(this._getType(b)!==q.nan){let $=this._getOrReturnCtx(b);return R($,{code:j.invalid_type,expected:q.nan,received:$.parsedType}),c}return{status:"valid",value:b.data}}}F1.create=(b)=>{return new F1({typeName:V.ZodNaN,...D(b)})};var s6=Symbol("zod_brand");class $2 extends F{_parse(b){let{ctx:w}=this._processInputParams(b),$=w.data;return this._def.type._parse({data:$,path:w.path,parent:w})}unwrap(){return this._def.type}}class E1 extends F{_parse(b){let{status:w,ctx:$}=this._processInputParams(b);if($.common.async)return(async()=>{let J=await this._def.in._parseAsync({data:$.data,path:$.path,parent:$});if(J.status==="aborted")return c;if(J.status==="dirty")return w.dirty(),h0(J.value);else return this._def.out._parseAsync({data:J.value,path:$.path,parent:$})})();else{let U=this._def.in._parseSync({data:$.data,path:$.path,parent:$});if(U.status==="aborted")return c;if(U.status==="dirty")return w.dirty(),{status:"dirty",value:U.value};else return this._def.out._parseSync({data:U.value,path:$.path,parent:$})}}static create(b,w){return new E1({in:b,out:w,typeName:V.ZodPipeline})}}class Y1 extends F{_parse(b){let w=this._def.innerType._parse(b),$=(U)=>{if(K0(U))U.value=Object.freeze(U.value);return U};return s0(w)?w.then((U)=>$(U)):$(w)}unwrap(){return this._def.innerType}}Y1.create=(b,w)=>{return new Y1({innerType:b,typeName:V.ZodReadonly,...D(w)})};function s3(b,w){let $=typeof b==="function"?b(w):typeof b==="string"?{message:b}:b;return typeof $==="string"?{message:$}:$}function $b(b,w={},$){if(b)return f0.create().superRefine((U,J)=>{let W=b(U);if(W instanceof Promise)return W.then((_)=>{if(!_){let X=s3(w,U),G=X.fatal??$??!0;J.addIssue({code:"custom",...X,fatal:G})}});if(!W){let _=s3(w,U),X=_.fatal??$??!0;J.addIssue({code:"custom",..._,fatal:X})}return});return f0.create()}var t6={object:I.lazycreate},V;(function(b){b.ZodString="ZodString",b.ZodNumber="ZodNumber",b.ZodNaN="ZodNaN",b.ZodBigInt="ZodBigInt",b.ZodBoolean="ZodBoolean",b.ZodDate="ZodDate",b.ZodSymbol="ZodSymbol",b.ZodUndefined="ZodUndefined",b.ZodNull="ZodNull",b.ZodAny="ZodAny",b.ZodUnknown="ZodUnknown",b.ZodNever="ZodNever",b.ZodVoid="ZodVoid",b.ZodArray="ZodArray",b.ZodObject="ZodObject",b.ZodUnion="ZodUnion",b.ZodDiscriminatedUnion="ZodDiscriminatedUnion",b.ZodIntersection="ZodIntersection",b.ZodTuple="ZodTuple",b.ZodRecord="ZodRecord",b.ZodMap="ZodMap",b.ZodSet="ZodSet",b.ZodFunction="ZodFunction",b.ZodLazy="ZodLazy",b.ZodLiteral="ZodLiteral",b.ZodEnum="ZodEnum",b.ZodEffects="ZodEffects",b.ZodNativeEnum="ZodNativeEnum",b.ZodOptional="ZodOptional",b.ZodNullable="ZodNullable",b.ZodDefault="ZodDefault",b.ZodCatch="ZodCatch",b.ZodPromise="ZodPromise",b.ZodBranded="ZodBranded",b.ZodPipeline="ZodPipeline",b.ZodReadonly="ZodReadonly"})(V||(V={}));var e6=(b,w={message:`Input not instance of ${b.name}`})=>$b(($)=>$ instanceof b,w),Ub=_0.create,Jb=O0.create,b7=F1.create,w7=F0.create,Wb=b1.create,$7=x0.create,U7=S1.create,J7=w1.create,W7=$1.create,_7=f0.create,X7=D0.create,G7=q0.create,Q7=K1.create,Y7=X0.create,H7=I.create,j7=I.strictCreate,q7=U1.create,z7=w2.create,R7=J1.create,M7=z0.create,N7=D1.create,A7=O1.create,c7=Z0.create,L7=e0.create,V7=W1.create,B7=_1.create,S7=E0.create,K7=X1.create,D7=g0.create,O7=Y0.create,F7=G0.create,E7=L0.create,C7=Y0.createWithPreprocess,k7=E1.create,P7=()=>Ub().optional(),I7=()=>Jb().optional(),T7=()=>Wb().optional(),v7={string:(b)=>_0.create({...b,coerce:!0}),number:(b)=>O0.create({...b,coerce:!0}),boolean:(b)=>b1.create({...b,coerce:!0}),bigint:(b)=>F0.create({...b,coerce:!0}),date:(b)=>x0.create({...b,coerce:!0})};var l7=c;var h7=Y.object({name:Y.string().regex(/^x-/),component:Y.unknown()}),_b=Y.function().returns(Y.object({name:Y.string(),extensions:Y.array(h7)}));var Xb=[["--theme-","--scalar-"],["--sidebar-","--scalar-sidebar-"]],x7=Xb.map(([b])=>b);function U2(b){if(!x7.some(($)=>b.includes($)))return b;return console.warn("DEPRECATION WARNING: It looks like you're using legacy CSS variables in your custom CSS string. Please migrate them to use the updated prefixes. See https://github.com/scalar/scalar/blob/main/documentation/themes.md#theme-prefix-changes"),Xb.reduce(($,[U,J])=>$.replaceAll(U,J),b)}var f7=Y.enum(["alternate","default","moon","purple","solarized","bluePlanet","deepSpace","saturn","kepler","elysiajs","fastify","mars","none"]),Z7=Y.enum(["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"]),g7=Y.enum(["adonisjs","docusaurus","dotnet","elysiajs","express","fastapi","fastify","go","hono","html","laravel","litestar","nestjs","nextjs","nitro","nuxt","platformatic","react","rust","vue"]).nullable(),Qb=Y.object({url:Y.string().optional(),content:Y.union([Y.string(),Y.record(Y.any()),Y.function().returns(Y.record(Y.any())),Y.null()]).optional(),title:Y.string().optional(),slug:Y.string().optional()}),m7=Y.object({basePath:Y.string()}),Yb=Y.object({url:Y.string().optional(),content:Y.union([Y.string(),Y.record(Y.any()),Y.function().returns(Y.record(Y.any())),Y.null()]).optional(),title:Y.string().optional(),slug:Y.string().optional(),spec:Qb.optional(),authentication:Y.any().optional(),baseServerURL:Y.string().optional(),hideClientButton:Y.boolean().optional().default(!1).catch(!1),proxyUrl:Y.string().optional(),searchHotKey:Z7.optional(),servers:Y.array(Y.any()).optional(),showSidebar:Y.boolean().optional().default(!0).catch(!0),theme:f7.optional().default("default").catch("default"),_integration:g7.optional(),onRequestSent:Y.function().args(Y.string()).returns(Y.void()).optional()}),Gb="https://api.scalar.com/request-proxy",s2="https://proxy.scalar.com",r7=Yb.merge(Y.object({layout:Y.enum(["modern","classic"]).optional().default("modern").catch("modern"),proxy:Y.string().optional(),plugins:Y.array(_b).optional(),isEditable:Y.boolean().optional().default(!1).catch(!1),isLoading:Y.boolean().optional().default(!1).catch(!1),hideModels:Y.boolean().optional().default(!1).catch(!1),hideDownloadButton:Y.boolean().optional().default(!1).catch(!1),hideTestRequestButton:Y.boolean().optional().default(!1).catch(!1),hideSearch:Y.boolean().optional().default(!1).catch(!1),darkMode:Y.boolean().optional(),forceDarkModeState:Y.enum(["dark","light"]).optional(),hideDarkModeToggle:Y.boolean().optional().default(!1).catch(!1),metaData:Y.any().optional(),favicon:Y.string().optional(),hiddenClients:Y.union([Y.record(Y.union([Y.boolean(),Y.array(Y.string())])),Y.array(Y.string()),Y.literal(!0)]).optional(),defaultHttpClient:Y.object({targetKey:Y.custom(),clientKey:Y.string()}).optional(),customCss:Y.string().optional(),onSpecUpdate:Y.function().args(Y.string()).returns(Y.void()).optional(),onServerChange:Y.function().args(Y.string()).returns(Y.void()).optional(),onDocumentSelect:Y.function().returns(Y.void().or(Y.void().promise())).optional(),onLoaded:Y.function().returns(Y.void().or(Y.void().promise())).optional(),onShowMore:Y.function().args(Y.string()).returns(Y.void().or(Y.void().promise())).optional(),onSidebarClick:Y.function().args(Y.string()).returns(Y.void().or(Y.void().promise())).optional(),pathRouting:m7.optional(),generateHeadingSlug:Y.function().args(Y.object({slug:Y.string().default("headingSlug")})).returns(Y.string()).optional(),generateModelSlug:Y.function().args(Y.object({name:Y.string().default("modelName")})).returns(Y.string()).optional(),generateTagSlug:Y.function().args(Y.object({name:Y.string().default("tagName")})).returns(Y.string()).optional(),generateOperationSlug:Y.function().args(Y.object({path:Y.string(),operationId:Y.string().optional(),method:Y.string(),summary:Y.string().optional()})).returns(Y.string()).optional(),generateWebhookSlug:Y.function().args(Y.object({name:Y.string(),method:Y.string().optional()})).returns(Y.string()).optional(),redirect:Y.function().args(Y.string()).returns(Y.string().nullable().optional()).optional(),withDefaultFonts:Y.boolean().optional().default(!0).catch(!0),defaultOpenAllTags:Y.boolean().optional(),tagsSorter:Y.union([Y.literal("alpha"),Y.function().args(Y.any(),Y.any()).returns(Y.number())]).optional(),operationsSorter:Y.union([Y.literal("alpha"),Y.literal("method"),Y.function().args(Y.any(),Y.any()).returns(Y.number())]).optional()})),y7=(b)=>{let w={...b};if(w.spec?.url)console.warn("[DEPRECATED] You're using the deprecated 'spec.url' attribute. Remove the spec prefix and move the 'url' attribute to the top level."),w.url=w.spec.url,delete w.spec;if(w.spec?.content)console.warn("[DEPRECATED] You're using the deprecated 'spec.content' attribute. Remove the spec prefix and move the 'content' attribute to the top level."),w.content=w.spec.content,delete w.spec;if(w.customCss)w.customCss=U2(w.customCss);if(w.proxy){if(console.warn("[DEPRECATED] You're using the deprecated 'proxy' attribute, rename it to 'proxyUrl' or update the package."),!w.proxyUrl)w.proxyUrl=w.proxy;delete w.proxy}if(w.proxyUrl===Gb)console.warn(`[DEPRECATED] Warning: configuration.proxyUrl points to our old proxy (${Gb}).`),console.warn(`[DEPRECATED] We are overwriting the value and use the new proxy URL (${s2}) instead.`),console.warn(`[DEPRECATED] Action Required: You should manually update your configuration to use the new URL (${s2}). Read more: https://github.com/scalar/scalar`),w.proxyUrl=s2;return w},d7=r7.transform(y7);var a7=Y.object({cdn:Y.string().optional().default("https://cdn.jsdelivr.net/npm/@scalar/api-reference"),pageTitle:Y.string().optional().default("Scalar API Reference")});var u7={alternate:f3,default:m3,moon:a3,elysiajs:t1,fastify:r3,purple:u3,solarized:o3,bluePlanet:Z3,deepSpace:g3,saturn:p3,kepler:y3,mars:d3};var uQ=Object.keys(u7);import{replaceSchemaType as s7,t as e2}from"elysia";function t2(b){return"type"in b||"properties"in b||"items"in b}function o7(b,w){return(b==="createdAt"||b==="updatedAt")&&"anyOf"in w&&Array.isArray(w.anyOf)}function qb(b){if(!t2(b)||typeof b!=="object"||b===null)return b;let w={...b};return Object.entries(w).forEach(([$,U])=>{if(t2(U))if(o7($,U)){let J=U.anyOf?.find((W)=>t2(W)&&W.format==="date-time");if(J){let W={type:"string",format:"date-time",default:J.default};w[$]=W}}else w[$]=qb(U)}),w}var n7=(b,w,$,U,J)=>{let W=JSON.parse(U);if(W.components&&W.components.schemas)W.components.schemas=Object.fromEntries(Object.entries(W.components.schemas).map(([X,G])=>[X,qb(G)]));let _=JSON.stringify(W);return`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${b.title}</title>
    <meta
        name="description"
        content="${b.description}"
    />
    <meta
        name="og:description"
        content="${b.description}"
    />
    ${J&&typeof $==="string"?`
    <style>
        @media (prefers-color-scheme: dark) {
            body {
                background-color: #222;
                color: #faf9a;
            }
            .swagger-ui {
                filter: invert(92%) hue-rotate(180deg);
            }

            .swagger-ui .microlight {
                filter: invert(100%) hue-rotate(180deg);
            }
        }
    </style>`:""}
    ${typeof $==="string"?`<link rel="stylesheet" href="${$}" />`:`<link rel="stylesheet" media="(prefers-color-scheme: light)" href="${$.light}" />
<link rel="stylesheet" media="(prefers-color-scheme: dark)" href="${$.dark}" />`}
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@${w}/swagger-ui-bundle.js" crossorigin></script>
    <script>
        window.onload = () => {
            window.ui = SwaggerUIBundle(${_});
        };
    </script>
</body>
</html>`},i7=(b,w,$,U)=>`<!doctype html>
<html>
  <head>
    <title>${b.title}</title>
    <meta
        name="description"
        content="${b.description}"
    />
    <meta
        name="og:description"
        content="${b.description}"
    />
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
      }
    </style>
    <style>
      ${$.customCss??t1}
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="${$.spec?.url}"
      data-configuration='${JSON.stringify($)}'
    >
    </script>
    <script src="${U?U:`https://cdn.jsdelivr.net/npm/@scalar/api-reference@${w}/dist/browser/standalone.min.js`}" crossorigin></script>
  </body>
</html>`,sQ=Symbol.for("TypeBox.Transform"),tQ=Symbol.for("TypeBox.Readonly"),eQ=Symbol.for("TypeBox.Optional"),bY=Symbol.for("TypeBox.Hint"),w5=Symbol.for("TypeBox.Kind"),t7=(b)=>b.split("/").map((w)=>{if(w.startsWith(":")){if(w=w.slice(1,w.length),w.endsWith("?"))w=w.slice(0,-1);w=`{${w}}`}return w}).join("/"),b5=(b,w,$)=>{if(w===void 0)return[];if(typeof w==="string")if(w in $)w=$[w];else throw new Error(`Can't find model ${w}`);return Object.entries(w?.properties??[]).map(([U,J])=>{let{type:W=void 0,description:_,examples:X,...G}=J;return{description:_,examples:X,schema:{type:W,...G},in:b,name:U,required:w.required?.includes(U)??!1}})},C1=(b,w)=>{if(typeof w==="object"&&["void","undefined","null"].includes(w.type))return;let $={};for(let U of b)$[U]={schema:typeof w==="string"?{$ref:`#/components/schemas/${w}`}:("$ref"in w)&&(w5 in w)&&w[w5]==="Ref"?{...w,$ref:`#/components/schemas/${w.$ref}`}:s7({...w},{from:e2.Ref(""),to:({$ref:J,...W})=>{if(!J.startsWith("#/components/schemas/"))return e2.Ref(`#/components/schemas/${J}`,W);return e2.Ref(J,W)}})};return $},Hb=(b)=>b.charAt(0).toUpperCase()+b.slice(1),e7=(b,w)=>{let $=b.toLowerCase();if(w==="/")return $+"Index";for(let U of w.split("/"))if(U.charCodeAt(0)===123)$+="By"+Hb(U.slice(1,-1));else $+=Hb(U);return $},H1=(b)=>{if(!b)return;if(typeof b==="string")return b;if(Array.isArray(b))return[...b];return{...b}},jb=({schema:b,path:w,method:$,hook:U,models:J})=>{if(U=H1(U),U.parse&&!Array.isArray(U.parse))U.parse=[U.parse];let W=U.parse?.map((B)=>{switch(typeof B){case"string":return B;case"object":if(B&&typeof B?.fn!=="string")return;switch(B?.fn){case"json":case"application/json":return"application/json";case"text":case"text/plain":return"text/plain";case"urlencoded":case"application/x-www-form-urlencoded":return"application/x-www-form-urlencoded";case"arrayBuffer":case"application/octet-stream":return"application/octet-stream";case"formdata":case"multipart/form-data":return"multipart/form-data"}}}).filter((B)=>B!==void 0);if(!W||W.length===0)W=["application/json","multipart/form-data","text/plain"];w=t7(w);let _=typeof W==="string"?[W]:W??["application/json"],X=H1(U?.body),G=H1(U?.params),Q=H1(U?.headers),H=H1(U?.query),z=H1(U?.response);if(typeof z==="object")if(w5 in z){let{type:B,properties:O,required:P,additionalProperties:x,patternProperties:Z,$ref:L,...K}=z;z={"200":{...K,description:K.description,content:C1(_,B==="object"||B==="array"?{type:B,properties:O,patternProperties:Z,items:z.items,required:P}:z)}}}else Object.entries(z).forEach(([B,O])=>{if(typeof O==="string"){if(!J[O])return;let{type:P,properties:x,required:Z,additionalProperties:L,patternProperties:K,...C}=J[O];z[B]={...C,description:C.description,content:C1(_,O)}}else{let{type:P,properties:x,required:Z,additionalProperties:L,patternProperties:K,...C}=O;z[B]={...C,description:C.description,content:C1(_,P==="object"||P==="array"?{type:P,properties:x,patternProperties:K,items:O.items,required:Z}:O)}}});else if(typeof z==="string"){if(!(z in J))return;let{type:B,properties:O,required:P,$ref:x,additionalProperties:Z,patternProperties:L,...K}=J[z];z={"200":{...K,content:C1(_,z)}}}let N=[...b5("header",Q,J),...b5("path",G,J),...b5("query",H,J)];b[w]={...b[w]?b[w]:{},[$.toLowerCase()]:{...Q||G||H||X?{parameters:N}:{},...z?{responses:z}:{},operationId:U?.detail?.operationId??e7($,w),...U?.detail,...X?{requestBody:{required:!0,content:C1(_,typeof X==="string"?{$ref:`#/components/schemas/${X}`}:X)}}:null}}},bw=(b,{excludeStaticFile:w=!0,exclude:$=[]})=>{let U={};for(let[J,W]of Object.entries(b))if(!$.some((_)=>{if(typeof _==="string")return J===_;return _.test(J)})&&!J.includes("*")&&(w?!J.includes("."):!0))Object.keys(W).forEach((_)=>{let X=W[_];if(J.includes("{")){if(!X.parameters)X.parameters=[];X.parameters=[...J.split("/").filter((G)=>G.startsWith("{")&&!X.parameters.find((Q)=>Q.in==="path"&&Q.name===G.slice(1,G.length-1))).map((G)=>({schema:{type:"string"},in:"path",name:G.slice(1,G.length-1),required:!0})),...X.parameters]}if(!X.responses)X.responses={200:{}}}),U[J]=W;return U},zb=({provider:b="scalar",scalarVersion:w="latest",scalarCDN:$="",scalarConfig:U={},documentation:J={},version:W="5.9.0",excludeStaticFile:_=!0,path:X="/swagger",specPath:G=`${X}/json`,exclude:Q=[],swaggerOptions:H={},theme:z=`https://unpkg.com/swagger-ui-dist@${W}/swagger-ui.css`,autoDarkMode:N=!0,excludeMethods:B=["OPTIONS"],excludeTags:O=[]}={})=>{let P={},x=0;if(!W)W=`https://unpkg.com/swagger-ui-dist@${W}/swagger-ui.css`;let Z={title:"Elysia Documentation",description:"Development documentation",version:"0.0.0",...J.info},L=X.startsWith("/")?X.slice(1):X,K=new p7({name:"@elysiajs/swagger"}),C=new Response(b==="swagger-ui"?n7(Z,W,z,JSON.stringify({url:G,dom_id:"#swagger-ui",...H},(d,H0)=>typeof H0==="function"?void 0:H0),N):i7(Z,w,{spec:{...U.spec,url:G},...U,_integration:"elysiajs"},$),{headers:{"content-type":"text/html; charset=utf8"}});return K.get(X,C,{detail:{hide:!0}}).get(G,function d(){let H0=K.getGlobalRoutes();if(H0.length!==x){let V1=["GET","PUT","POST","DELETE","OPTIONS","HEAD","PATCH","TRACE"];x=H0.length,H0.forEach((w0)=>{if(w0.hooks?.detail?.hide===!0)return;if(B.includes(w0.method))return;if(V1.includes(w0.method)===!1&&w0.method!=="ALL")return;if(w0.method==="ALL")V1.forEach((c6)=>{jb({schema:P,hook:w0.hooks,method:c6,path:w0.path,models:K.getGlobalDefinitions?.().type,contentType:w0.hooks.type})});else jb({schema:P,hook:w0.hooks,method:w0.method,path:w0.path,models:K.getGlobalDefinitions?.().type,contentType:w0.hooks.type})})}return{openapi:"3.0.3",...{...J,tags:J.tags?.filter((V1)=>!O?.includes(V1?.name)),info:{title:"Elysia Documentation",description:"Development documentation",version:"0.0.0",...J.info}},paths:{...bw(P,{excludeStaticFile:_,exclude:Array.isArray(Q)?Q:[Q]}),...J.paths},components:{...J.components,schemas:{...K.getGlobalDefinitions?.().type,...J.components?.schemas}}}},{detail:{hide:!0}}),K};import{Elysia as ww}from"elysia";var $w=typeof new Headers()?.toJSON==="function",Uw=(b)=>{if($w)return Object.keys(b.toJSON()).join(", ");let w="",$=0;return b.forEach((U,J)=>{if($)w=w+", "+J;else w=J;$++}),w},Rb=(b)=>{let{aot:w=!0,origin:$=!0,methods:U=!0,allowedHeaders:J=!0,exposeHeaders:W=!0,credentials:_=!0,maxAge:X=5,preflight:G=!0}=b??{};if(Array.isArray(J))J=J.join(", ");if(Array.isArray(W))W=W.join(", ");let Q=typeof $==="boolean"?void 0:Array.isArray($)?$:[$],H=new ww({name:"@elysiajs/cors",seed:b,aot:w}),z=Q?.some((L)=>L==="*"),N={};if(Q){for(let L of Q)if(typeof L==="string")N[L]=!0}let B=(L,K,C)=>{if(Array.isArray(L))return L.some((d)=>B(d,K,C));switch(typeof L){case"string":if(C in N)return!0;let d=C.indexOf("://");if(d!==-1)C=C.slice(d+3);return L===C;case"function":return L(K)===!0;case"object":if(L instanceof RegExp)return L.test(C)}return!1},O=(L,K)=>{if($===!0){L.headers.vary="*",L.headers["access-control-allow-origin"]=K.headers.get("Origin")||"*";return}if(z){L.headers.vary="*",L.headers["access-control-allow-origin"]="*";return}if(!Q?.length)return;let C=[];if(Q.length){let d=K.headers.get("Origin")??"";for(let H0=0;H0<Q.length;H0++)if(B(Q[H0],K,d)===!0){L.headers.vary=$?"Origin":"*",L.headers["access-control-allow-origin"]=d||"*";return}}if(L.headers.vary="Origin",C.length)L.headers["access-control-allow-origin"]=C.join(", ")},P=(L,K)=>{if(!K)return;if(U===!0)return L.headers["access-control-allow-methods"]=K??"*";if(U===!1||!U?.length)return;if(U==="*")return L.headers["access-control-allow-methods"]="*";if(!Array.isArray(U))return L.headers["access-control-allow-methods"]=U;L.headers["access-control-allow-methods"]=U.join(", ")},x={};if(typeof W==="string")x["access-control-expose-headers"]=W;if(typeof J==="string")x["access-control-allow-headers"]=J;if(_===!0)x["access-control-allow-credentials"]="true";H.headers(x);function Z({set:L,request:K,headers:C}){if(O(L,K),P(L,K.headers.get("access-control-request-method")),J===!0||W===!0){if(J===!0)L.headers["access-control-allow-headers"]=C["access-control-request-headers"];if(W===!0)L.headers["access-control-expose-headers"]=Object.keys(C).join(",")}if(X)L.headers["access-control-max-age"]=X.toString();return new Response(null,{status:204})}if(G)H.options("/",Z).options("/*",Z);return H.onRequest(function L({set:K,request:C}){if(O(K,C),P(K,C.method),J===!0||W===!0){let d=Uw(C.headers);if(J===!0)K.headers["access-control-allow-headers"]=d;if(W===!0)K.headers["access-control-expose-headers"]=d}})};import{Kysely as Jw,SqliteDialect as Ww}from"kysely";import _w from"bun:sqlite";var Mb=()=>{let b=new _w(process.env.SQLITE_PATH);return{db:new Jw({dialect:new Ww({database:b})}),sqlite:b}},Nb=async(b)=>{await b.schema.createTable("workflows").ifNotExists().addColumn("id","integer",(w)=>w.primaryKey().autoIncrement()).addColumn("name","text",(w)=>w.notNull().unique()).addColumn("config","text",(w)=>w.notNull()).addColumn("created_at","text",(w)=>w.notNull().defaultTo("CURRENT_TIMESTAMP")).execute(),await b.schema.createTable("webhooks").ifNotExists().addColumn("id","integer",(w)=>w.primaryKey().autoIncrement()).addColumn("workflow_id","integer",(w)=>w.notNull().references("workflows.id").onDelete("cascade")).addColumn("url","text",(w)=>w.notNull()).addColumn("secret","text").addColumn("created_at","text",(w)=>w.notNull().defaultTo("CURRENT_TIMESTAMP")).addColumn("is_active","boolean",(w)=>w.notNull().defaultTo(!0)).execute()};class $5{nodeMap;constructor(b){this.nodeMap=b}loadNodes(b){let w=new Map;for(let[$,U]of Object.entries(b)){let J=this.nodeMap[U.type],W=!0;if(!S(`../nodes/${J}.ts`))throw new Error(`Unknown node type: ${U.type}`);w.set($,U)}return w}loadConnections(b,w){let $=new Map;for(let[U,J]of Object.entries(b)){if(!w.has(U))throw new Error(`Unknown source node: ${U}`);J.forEach((W)=>{if(!w.has(W))throw new Error(`Unknown target node: ${W}`)}),$.set(U,J)}return this.ensureAcyclic($),$}ensureAcyclic(b){let w=new Set,$=new Set,U=(J)=>{if($.has(J))throw new Error(`Cycle detected at: ${J}`);if(w.has(J))return;w.add(J),$.add(J),(b.get(J)||[]).forEach(U),$.delete(J)};[...b.keys()].forEach(U)}load(b){let w=this.loadNodes(b.nodes),$=this.loadConnections(b.connections,w);return{nodes:w,connections:$}}}var y=[];for(let b=0;b<256;++b)y.push((b+256).toString(16).slice(1));function Ab(b,w=0){return(y[b[w+0]]+y[b[w+1]]+y[b[w+2]]+y[b[w+3]]+"-"+y[b[w+4]]+y[b[w+5]]+"-"+y[b[w+6]]+y[b[w+7]]+"-"+y[b[w+8]]+y[b[w+9]]+"-"+y[b[w+10]]+y[b[w+11]]+y[b[w+12]]+y[b[w+13]]+y[b[w+14]]+y[b[w+15]]).toLowerCase()}import{randomFillSync as Xw}from"crypto";var W2=new Uint8Array(256),J2=W2.length;function U5(){if(J2>W2.length-16)Xw(W2),J2=0;return W2.slice(J2,J2+=16)}import{randomUUID as Gw}from"crypto";var J5={randomUUID:Gw};function Qw(b,w,$){if(J5.randomUUID&&!w&&!b)return J5.randomUUID();b=b||{};let U=b.random??b.rng?.()??U5();if(U.length<16)throw new Error("Random bytes length must be >= 16");if(U[6]=U[6]&15|64,U[8]=U[8]&63|128,w){if($=$||0,$<0||$+16>w.length)throw new RangeError(`UUID byte range ${$}:${$+15} is out of buffer bounds`);for(let J=0;J<16;++J)w[$+J]=U[J];return w}return Ab(U)}var W5=Qw;import{JSONPath as Yw}from"jsonpath-plus";function Hw(b,w){if(console.log("EVALUATE ",b,w),!w)return"";try{let $=Yw({path:w,json:b}),U=Array.isArray($)?$[0]:$;return U!==void 0?U:null}catch($){return null}}function _2(b,w){return Hw(b,w).toString()??""}class _5{store;workflowId;constructor(b,w){this.store=b;this.workflowId=w}getFromObject(b,w){return _2(b,w)}async getFrom(b,w){console.log("GET FROM",w),console.log("DATA",b);let $=/^\$\.context\.([^.\[]+)(.*)$/,U=w.match($);if(!U)return _2(b,w);let[,J,W]=U,_=await this.store.get(this.workflowId,J);if(!_)throw new Error(`Context object '${J}' not found`);if(W){let X=`$${W}`;return _2(_,X)}return _}}function cb(b){return S(`../nodes/${fileName}.ts`)}function jw(b,w){let U=b.toString().match(/constructor\s*\(([^)]*)\)/);if(!U)throw new Error("Не удалось найти конструктор");let W=U[1].split(",").map((_)=>_.trim().split(/\s+/)[0]).filter((_)=>_).map((_)=>w[_]);return new b(...W)}class X5{uuid;nodes;connections;storage;accessor;constructor(b,w,$){this.uuid=W5(),this.storage=$,this.nodes=new Map;for(let[U,J]of w.nodes){let W=b[J.type],_=cb(W);if(!_)throw new Error(`Unknown node type: ${J.type}`);console.log("NEDEID",U,J.params),this.nodes.set(U,jw(_,{name:U,...J.params}))}this.accessor=new _5(this.storage,this.uuid),this.connections=new Map(w.connections)}async executeNode(b,w){let $=this.nodes.get(b);if(!$)throw new Error(`Node not found: ${b}`);return await $.execute(w,this.accessor)}async execute(b,w){let $=new Set,U=[{nodeId:b,data:w}],J=w;while(U.length){let{nodeId:W,data:_}=U.shift();if(console.log("PROCESS",W),$.has(W))continue;J=await this.executeNode(W,_),console.log("LASTPROCESS RESULT",J),$.add(W),this.storage.save(this.uuid,W,J);for(let X of this.connections.get(W)??[])if(!$.has(X))U.push({nodeId:X,data:J})}return J}getConfig(){return{nodes:new Map(this.nodes),connections:new Map(this.connections)}}}var qw={StartNode:"start",PrintNode:"print",AiRequest:"ai-request",SQLQueryNode:"sql-query",TemplateInjectorNode:"template",RandomStringNode:"random",MarkNode:"mark"},G5=qw;class Q5{token;model;name="openai";constructor(b,w){this.token=b;this.model=w}async request(b){let w=[];if(b.system)w.push({role:"system",content:[{type:"input_text",text:b.system}]});w.push({role:"user",content:[{type:"input_text",text:b.user}]});let $=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${this.token}`},body:JSON.stringify({model:this.model,input:w,stream:!1})});if(!$.ok)throw new Error(`OpenAI Responses API error ${$.status}: ${await $.text()}`);return{body:(await $.json()).output?.[0]?.content?.[0]?.text??""}}}var J0=p2(g5(),1),Z4=J0.default.Client,BH=J0.default.Pool,SH=J0.default.Connection,KH=J0.default.types,DH=J0.default.Query,OH=J0.default.DatabaseError,FH=J0.default.escapeIdentifier,EH=J0.default.escapeLiteral,CH=J0.default.Result,kH=J0.default.TypeOverrides,PH=J0.default.defaults;class A2{connection;name="postgres";client;constructor(b){this.connection=b;console.log("PostgresProvider constructor",b),this.client=new Z4({connectionString:b})}async init(){try{await this.client.connect(),console.log(`[${this.name}] Connected to PostgreSQL`)}catch(b){throw console.error(`[${this.name}] Connection failed:`,b.message),new Error(`Failed to connect to PostgreSQL: ${b.message}`)}}async deinit(){try{await this.client.end(),console.log(`[${this.name}] Disconnected from PostgreSQL`)}catch(b){throw console.error(`[${this.name}] Disconnect error:`,b.message),new Error(`Failed to disconnect from PostgreSQL: ${b.message}`)}}async query(b,w){try{return(await this.client.query(b,w)).rows}catch($){throw console.error(`[${this.name}] Query failed:`,$.message),new Error(`Database query failed: ${$.message}`)}}}var j6=p2(a4(),1);var T3=H6().ClassicLevel;class y2{db=null;dbPath;constructor(b="./workflow-data"){this.dbPath=b}async init(){this.db=new T3(this.dbPath,{valueEncoding:"json"}),await this.db.open()}async deinit(){if(this.db)await this.db.close(),this.db=null}getDb(){if(!this.db)throw new Error("Database not initialized");return this.db}async put(b,w){console.log("PUT KEY: ",b),await this.getDb().put(b,w)}async get(b){try{return await this.getDb().get(b)}catch(w){if(w.code==="LEVEL_NOT_FOUND")return null;throw w}}async delete(b){await this.getDb().del(b)}async exists(b){try{return await this.getDb().get(b),!0}catch(w){if(w.code==="LEVEL_NOT_FOUND")return!1;throw w}}}class n0{provider;static instance;constructor(b){this.provider=b}static getInstance(b){if(!n0.instance)n0.instance=new n0(b??new y2);return n0.instance}async init(){await this.provider.init()}async deinit(){await this.provider.deinit()}async save(b,w,$){await this.provider.put(`${b}:${w}`,$)}async get(b,w){return await this.provider.get(`${b}:${w}`)}}j6.config();async function KG(){let b=n0.getInstance(new y2(process.env.LEVEL_DB_PATH));return await b.init(),b}class q6{salesProvider;emailsProvider;openaiProvider;store;constructor(){if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL environment variable is required");if(!process.env.OPENAI_API_KEY)throw new Error("OPENAI_API_KEY environment variable is required");if(!process.env.OPENAI_MODEL)throw new Error("OPENAI_MODEL environment variable is required");this.salesProvider=new A2(process.env.DATABASE_URL+"/sales"),this.emailsProvider=new A2(process.env.DATABASE_URL+"/emails"),this.openaiProvider=new Q5(process.env.OPENAI_API_KEY,process.env.OPENAI_MODEL)}async init(){await this.salesProvider.init(),await this.emailsProvider.init(),this.store=await KG()}async deinit(){await this.salesProvider.deinit(),await this.emailsProvider.deinit()}}var DG=new q6,d2=DG;class v3{db;constructor(b){this.db=b}async getAll(){return await this.db.selectFrom("workflows").selectAll().execute()}async getById(b){return await this.db.selectFrom("workflows").selectAll().where("id","=",b).executeTakeFirst()}async create(b,w){return await this.db.insertInto("workflows").values({name:b,config:JSON.stringify(w),created_at:new Date().toISOString()}).returning(["id","name"]).executeTakeFirstOrThrow()}async update(b,w,$){return await this.db.updateTable("workflows").set({name:w,config:JSON.stringify($)}).where("id","=",b).returning(["id","name"]).executeTakeFirst()}async delete(b){return await this.db.deleteFrom("workflows").where("id","=",b).executeTakeFirst()}async execute(b,w,$){let U=await this.getById(b);if(!U)throw new Error("Workflow not found");let J=JSON.parse(U.config),_=new $5(G5).load(J);return await new X5(G5,_,d2.store).execute(w,$),{workflowId:b,startNode:w,data:$}}async triggerWebhooks(b,w){let $=await this.db.selectFrom("webhooks").selectAll().where("workflow_id","=",b).where("is_active","=",!0).execute(),U=[];for(let J of $)try{let W=await fetch(J.url,{method:"POST",headers:{"Content-Type":"application/json",...J.secret&&{"X-Webhook-Secret":J.secret}},body:JSON.stringify({workflowId:b,data:w,timestamp:new Date().toISOString()})});U.push({webhookId:J.id,success:W.ok})}catch(W){U.push({webhookId:J.id,success:!1})}return U}}class l3{db;constructor(b){this.db=b}async getByWorkflowId(b){return await this.db.selectFrom("webhooks").selectAll().where("workflow_id","=",b).execute()}async getAll(){return await this.db.selectFrom("webhooks").innerJoin("workflows","webhooks.workflow_id","workflows.id").select(["webhooks.id","webhooks.url","webhooks.secret","webhooks.is_active","workflows.name as workflow_name"]).execute()}async create(b,w,$){return await this.db.insertInto("webhooks").values({workflow_id:b,url:w,secret:$||null,created_at:new Date().toISOString(),is_active:!0}).returning(["id","workflow_id","url"]).executeTakeFirstOrThrow()}async delete(b){return await this.db.deleteFrom("webhooks").where("id","=",b).executeTakeFirst()}}var z6=Y.object({name:Y.string().min(1),config:Y.any()}),R6=Y.object({name:Y.string().min(1),config:Y.any()}),M6=Y.object({startNode:Y.string().optional().default("start"),data:Y.any().optional().default({})}),N6=Y.object({url:Y.string().url(),secret:Y.string().optional()});var{db:h3,sqlite:mj}=Mb();await Nb(h3);await d2.init();var l0=new v3(h3),a2=new l3(h3),A6=new OG().use(Rb()).use(zb({path:"/docs"})).group("/api",(b)=>b.group("/workflows",(w)=>w.get("/",async()=>{return(await l0.getAll()).map((U)=>({...U,config:JSON.parse(U.config)}))},{detail:{tags:["Workflows"]}}).post("/",async({body:$,set:U})=>{try{let J=await l0.create($.name,$.config);return U.status=201,J}catch(J){if(J.message.includes("UNIQUE"))return U.status=409,{error:"Name exists"};throw J}},{body:z6,detail:{tags:["Workflows"]}}).get("/:id",async({params:$,set:U})=>{let J=await l0.getById($.id);if(!J)return U.status=404,{error:"Not found"};return{...J,config:JSON.parse(J.config)}},{detail:{tags:["Workflows"]}}).put("/:id",async({params:$,body:U,set:J})=>{let W=await l0.update($.id,U.name,U.config);if(!W)return J.status=404,{error:"Not found"};return W},{body:R6,detail:{tags:["Workflows"]}}).delete("/:id",async({params:$,set:U})=>{if((await l0.delete($.id)).numDeletedRows===0)return U.status=404,{error:"Not found"};return{message:"Deleted"}},{detail:{tags:["Workflows"]}}).post("/:id/execute",async({params:$,body:U})=>{return await l0.execute($.id,U.startNode,U.data)},{body:M6,detail:{tags:["Workflows"]}}).get("/:id/webhooks",async({params:$})=>{return await a2.getByWorkflowId($.id)},{detail:{tags:["Webhooks"]}}).post("/:id/webhooks",async({params:$,body:U,set:J})=>{let W=await a2.create($.id,U.url,U.secret);return J.status=201,W},{body:N6,detail:{tags:["Webhooks"]}})).group("/webhooks",(w)=>w.get("/",async()=>{return await a2.getAll()},{detail:{tags:["Webhooks"]}}).delete("/:id",async({params:$,set:U})=>{if((await a2.delete($.id)).numDeletedRows===0)return U.status=404,{error:"Not found"};return{message:"Deleted"}},{detail:{tags:["Webhooks"]}}))).post("/webhook/:workflowId",async({params:b,body:w})=>{let $=await l0.execute(b.workflowId,"start",w),U=await l0.triggerWebhooks(b.workflowId,w);return{execution:$,webhooks:U}});import x3 from"process";A6.listen(x3.env.PORT||3000);console.log("Server: http://localhost:3000");console.log("Docs: http://localhost:3000/docs");x3.on("SIGINT",async()=>{await providers.deinit(),sqlite.close(),x3.exit(0)});
