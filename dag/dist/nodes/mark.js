import{marked as a}from"marked";class n{name;templatePath;convertToHtml;scope;constructor(r,o,e=!1){this.name=r;this.templatePath=o;this.convertToHtml=e}async execute(r,o){let e=await o.getFrom(r,this.templatePath);if(!e)throw new Error(`No data found at JSON path: ${this.templatePath}`);try{let t=a(e,{breaks:!0});if(this.convertToHtml)t=`<!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                </head>
                <body>${t}</body>
                </html>`;return t}catch(t){throw new Error(`Error converting markdown to HTML: ${t.message}`)}}}export{n as MarkNode};
