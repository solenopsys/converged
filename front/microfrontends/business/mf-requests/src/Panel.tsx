import React from "react";
import { RequestsListView } from "./views/RequestsListView";

function Panel({ bus }: { bus: any }) {
  return <RequestsListView bus={bus} />;
}

export default Panel;
