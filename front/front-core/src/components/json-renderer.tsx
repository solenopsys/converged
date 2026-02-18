// import React from "react";
// import { JsonViewer } from "@textea/json-viewer";


// export  function JsonRenderer({ data }: { data: any }) {
//   return (
//     <div className="w-full h-screen flex flex-col p-2 text-white">
//       <h2 className="text-lg font-semibold mb-2 shrink-0">Контекст</h2>

//       {/* ВАЖНО: min-h-0 разрешает дочернему занять всю высоту и правильно схлопываться */}
//       <div className="flex-1 min-h-0 rounded-lg border border-neutral-700">
//         <div className="h-full">
//           <JsonViewer
//             value={data}
//             theme="dark"
//             displayDataTypes={false}
//             defaultInspectDepth={2}
//             /* растягиваем именно JsonViewer */
//             style={{ height: "100%", overflow: "auto", padding: "20px" }}
//           />
//         </div>
//       </div>
//     </div>
//   );
// }

export function JsonRenderer({ data }: { data: any }) {
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
