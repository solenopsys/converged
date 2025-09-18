

import { JsonRenderer } from "converged-core";



export default function ContextView({ data }: { data: any }) {
  return (
    <JsonRenderer data={data} />
  );
}