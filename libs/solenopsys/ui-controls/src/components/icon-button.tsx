import { Component } from '@solenopsys/converged-renderer';

interface IconButtonProps {
  icon?: string;
  click : (event:any) => void;
}

export const IconButton: Component<IconButtonProps> = (props) => {
  return (<div onClick={(event) => props.click(event)}>
    <img
      src={`${props.icon || ''}`}
      style={{ height: '16px', cursor: 'pointer', margin: '5px', filter: 'var(--invertIcons)' }}
    />
    {props.title}
    </div>
  );
};

 