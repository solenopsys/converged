import{u as t}from"./jsxRuntime-BreS2Ahj.js";import{k as h}from"./iframe-BIqZQAoS.js";import"./preload-helper-Dp1pzeXC.js";function M(...r){return r.filter(Boolean).join(" ")}function w({ast:r,className:e}){return t("div",{className:M("markdown-content",e),children:t(_,{node:r})})}function _({node:r}){var c,i,m,d,p,u;if(!r)return null;if(r.type==="text")return r.text||"";const e=(c=r.children)==null?void 0:c.map((n,o)=>t(_,{node:n},o));switch({paragraph:"p",heading:"h",emphasis:"em",list:"ul",listItem:"li",break:"br",softbr:"br",quote:"blockquote"}[r.type]||r.type){case"root":case"doc":return t(h,{children:e});case"p":return t("p",{className:"leading-7 [&:not(:first-child)]:mt-4 mb-4",children:e});case"strong":return t("strong",{className:"font-semibold",children:e});case"em":return t("em",{children:e});case"h":{const n=((i=r.details)==null?void 0:i.level)||1,o=`h${n}`;return t(o,{className:{1:"mt-8 scroll-m-20 text-4xl font-bold tracking-tight lg:text-5xl first:mt-0 mb-6",2:"mt-10 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0 mb-4",3:"mt-8 scroll-m-20 text-2xl font-semibold tracking-tight mb-3",4:"mt-6 scroll-m-20 text-xl font-semibold tracking-tight mb-2",5:"mt-4 scroll-m-20 text-lg font-semibold tracking-tight mb-2",6:"mt-4 scroll-m-20 text-base font-semibold tracking-tight mb-2"}[n],children:e})}case"a":{const n=((m=r.details)==null?void 0:m.href)||"#";return t("a",{href:n,className:"font-medium text-primary underline underline-offset-4 hover:text-primary/80",target:n.startsWith("http")?"_blank":void 0,rel:n.startsWith("http")?"noopener noreferrer":void 0,children:e})}case"img":return t("img",{src:((d=r.details)==null?void 0:d.src)||"",alt:((p=r.details)==null?void 0:p.alt)||"",className:"max-w-full h-auto rounded-lg my-4"});case"code":return t("code",{className:"relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold text-foreground",children:r.text||e});case"code_block":return t("pre",{className:"mb-4 mt-6 overflow-x-auto rounded-lg border bg-muted p-4",children:t("code",{className:"relative font-mono text-sm",children:r.text||e})});case"blockquote":return t("blockquote",{className:"mt-6 border-l-2 border-primary pl-6 italic text-muted-foreground",children:e});case"ul":{const n=(u=r.details)==null?void 0:u.is_tight;return t("ul",{className:"my-6 ml-6 list-disc [&>li]:mt-2","data-tight":n,children:e})}case"ol":return t("ol",{className:"my-6 ml-6 list-decimal [&>li]:mt-2",children:e});case"li":return t("li",{children:e});case"hr":return t("hr",{className:"my-8 border-border"});case"table":return t("div",{className:"my-6 w-full overflow-y-auto",children:t("table",{className:"w-full",children:e})});case"thead":return t("thead",{children:e});case"tbody":return t("tbody",{children:e});case"tr":return t("tr",{className:"m-0 border-t p-0 even:bg-muted",children:e});case"th":return t("th",{className:"border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right",children:e});case"td":return t("td",{className:"border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right",children:e});case"br":return t("br",{});case"del":return t("del",{children:e});case"u":return t("u",{children:e});case"html":return t("div",{dangerouslySetInnerHTML:{__html:r.text||""}});default:return console.warn(`Unknown markdown node type: ${r.type}`),t(h,{children:e})}}w.__docgenInfo={description:"",methods:[],displayName:"MarkdownRenderer",props:{ast:{required:!0,tsType:{name:"MarkdownASTNode"},description:""},className:{required:!1,tsType:{name:"string"},description:""}}};const C={title:"Components/MarkdownRenderer",component:w,parameters:{layout:"padded"},tags:["autodocs"]},s={args:{ast:{type:"root",children:[{type:"heading",details:{level:1},children:[{type:"text",text:"Hello World"}]},{type:"paragraph",children:[{type:"text",text:"This is a paragraph."}]}]}}},a={args:{ast:{type:"root",children:[{type:"list",children:[{type:"listItem",children:[{type:"text",text:"Item 1"}]},{type:"listItem",children:[{type:"text",text:"Item 2"}]},{type:"listItem",children:[{type:"text",text:"Item 3"}]}]}]}}},l={args:{ast:{type:"root",children:[{type:"code_block",text:`const x = 42;
console.log(x);`}]}}};var g,x,y;s.parameters={...s.parameters,docs:{...(g=s.parameters)==null?void 0:g.docs,source:{originalSource:`{
  args: {
    ast: {
      type: "root",
      children: [{
        type: "heading",
        details: {
          level: 1
        },
        children: [{
          type: "text",
          text: "Hello World"
        }]
      }, {
        type: "paragraph",
        children: [{
          type: "text",
          text: "This is a paragraph."
        }]
      }]
    }
  }
}`,...(y=(x=s.parameters)==null?void 0:x.docs)==null?void 0:y.source}}};var b,f,k;a.parameters={...a.parameters,docs:{...(b=a.parameters)==null?void 0:b.docs,source:{originalSource:`{
  args: {
    ast: {
      type: "root",
      children: [{
        type: "list",
        children: [{
          type: "listItem",
          children: [{
            type: "text",
            text: "Item 1"
          }]
        }, {
          type: "listItem",
          children: [{
            type: "text",
            text: "Item 2"
          }]
        }, {
          type: "listItem",
          children: [{
            type: "text",
            text: "Item 3"
          }]
        }]
      }]
    }
  }
}`,...(k=(f=a.parameters)==null?void 0:f.docs)==null?void 0:k.source}}};var N,v,I;l.parameters={...l.parameters,docs:{...(N=l.parameters)==null?void 0:N.docs,source:{originalSource:`{
  args: {
    ast: {
      type: "root",
      children: [{
        type: "code_block",
        text: "const x = 42;\\nconsole.log(x);"
      }]
    }
  }
}`,...(I=(v=l.parameters)==null?void 0:v.docs)==null?void 0:I.source}}};const L=["Heading","List","CodeBlock"];export{l as CodeBlock,s as Heading,a as List,L as __namedExportsOrder,C as default};
