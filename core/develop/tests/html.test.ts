import { indexHtmlTransform } from "../src/tools/html";

const SOURCE_HTML = `
<html>

<head>
    <script type="importmap"> </script>
</head>

<body id="layout" style="padding: 0;margin: 0;">

</body>
<script type="module" ></script>

</html>
`;

const INDEX_JS = `
  console.log(entry)
  `

const RESULT_HTML = `
<html>

<head>
    <script type="importmap"> 
    { "imports":
    {
        "bla": "/library/bla.mjs"
    }
}</script>
</head>

<body id="layout" style="padding: 0;margin: 0;">

</body>
<script type="module" >
const entry=JSON.parse(\`{ \"bla\": \"test.json\"}\`); 
console.log(entry)
</script>
</html>
  `;


const ENTRY_JSON = `{
    "bla": "test.json"
}`

const IMPORTS = {
    "bla": "/library/bla.mjs",
}

function normalize(str: string) {
    return str.replace(/\n/g, "").replace(/\t/g, "").replace(/\s+/g, "").trim();
}



describe("html", () => {
    test("inject", async () => {
        const resultHtmlt = indexHtmlTransform(SOURCE_HTML, INDEX_JS, IMPORTS, ENTRY_JSON)
        expect(normalize(resultHtmlt)).toEqual(normalize(RESULT_HTML));
    });
});