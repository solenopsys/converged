import{loadModule as t}from"@solenopsys/converged-renderer";var o=JSON.parse("$TEMPLATE_ENTRY");console.log("ENTRY",o);var e=await t(o.layout.module._uri);e.createLayout("layout",t,o.layout.data);
