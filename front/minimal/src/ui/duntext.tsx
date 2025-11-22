import $ from "@solenopsys/converged-reactive";
import { If } from "@solenopsys/converged-renderer";

interface DunTextProps {
  buttonText?: string;
  content: any;
}

const DunText = ({ buttonText = "Click me", content }: DunTextProps) => {
  const visible = $(false);
  $.effect(() => {
    console.log("visible", visible());
  });
  const toggle = () => {
    visible(!visible());
  };

  return (
    <>
      ok
      <button onClick={toggle}>{buttonText}</button>? <p>{content} ok</p>
      <If when={visible}>
        <p>Hello1!</p>
      </If>
    </>
  );
};

export { DunText };
