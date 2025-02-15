import {  Component } from '@solenopsys/converged-renderer';

import $ from '@solenopsys/converged-reactive';;
import {EffectFunction} from '@solenopsys/converged-reactive';;

import styles from "./styles/ui-button.module.css";



interface UiButtonProps {
  title: string;
  onButtonClick?: EffectFunction;
}

export const UiButton: Component<UiButtonProps> = (props) => {

console.log("CREATE BUTTON")
  const state = $(props.title);

  $.effect(() => console.log('Title', state()));
 
  return ()=>{
    
  const handleClick = () => {

    state("Button Clicked2!");
    if (props.onButtonClick) {
      props.onButtonClick();
    }
  };

    return ()=>
    (<>
      <button class={styles.button} onClick={handleClick} title={state()}>
        {state()} 
      </button>
    </>)
  };
};


export default UiButton