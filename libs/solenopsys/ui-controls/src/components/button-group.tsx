import { Component } from '@solenopsys/converged-renderer';
 
import {IconButton} from './icon-button'

export type ActionButton = {
    key: string;
    title: string;
    icon: string;
}


interface ButtonGroupProps {
  actions: ActionButton[];
  emmitAction: (action: string) => void;
}

export const ButtonGroup: Component<ButtonGroupProps> = (props) => {
  console.log("BUTTON GROUP", props);
  return (
    <>
      {props.actions.map((action) => (
        <IconButton
          key={action.key}
          icon={action.icon}
          title={action.title}
          click={(e:any)=> props.emmitAction(action.key)}  />
      ))}
    </>
  );
};

 