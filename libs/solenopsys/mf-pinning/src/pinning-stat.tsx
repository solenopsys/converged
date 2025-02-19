import { UiButton } from "@solenopsys/ui-controls";
import { UiProperties } from "@solenopsys/ui-lists";


import $ from '@solenopsys/converged-reactive';
 
import {  Component,useResource } from '@solenopsys/converged-renderer';
 

const fetchProperties = async () =>
    (await fetch(`/stat`)).json();



interface StatProps {
  values: {[key:string]:string};
  onButtonClick: () => void;
}

const PinnginStat: Component = () => {

  const properties = useResource( fetchProperties);
 

  return (
    <div>
      <span>{properties.pending && "Loading..."}</span>
      {properties() && <UiProperties properties={properties()}></UiProperties>}

     

      <UiButton title="HW"  />
    </div>
  );
};

export default PinnginStat;
