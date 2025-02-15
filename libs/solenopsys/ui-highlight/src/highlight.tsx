import { Component, If,html, } from "@solenopsys/converged-renderer";
import Prism from 'prismjs';



interface HighlightProps {
	code: string;
	language: string;
	inline?: boolean;
}

export const Highlight: Component<HighlightProps> = (props) => {
  // Prism.highlightAll();
  const res=  Prism.highlight(props.code, Prism.languages.javascript, 'javascript');


  


	 return (
		<>
		
			<If when={props.inline}>
				<code class={"language-" + props.language} style="padding:5px;" dangerouslySetInnerHTML={{ __html: res }}></code>
			</If>
			<If when={!props.inline}>
				<pre class={"language-" + props.language} style="border-radius:5px; padding:15px;">
					<code class={"language-" + props.language} style="text-background-color:black;" dangerouslySetInnerHTML={{ __html: res }}></code>
				</pre>
			</If>
		</>
	); 
};
