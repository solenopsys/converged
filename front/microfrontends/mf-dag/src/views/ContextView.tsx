

import { JsonRenderer } from "front-core";



export default function ContextView({ data }: { data: any }) {
  return (
    <JsonRenderer data={data} />
  );
}