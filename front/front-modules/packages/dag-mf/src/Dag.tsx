import {useEffect} from "react";
import {DAGController} from "./renderer";

export default function DagViewer() {
 
    useEffect(() => {
        const controller = new DAGController('dagCanvas');
    }, []);


    return (
      <canvas  id="dagCanvas" width={400} height={800} >
 
       
      </canvas>
    );
  }
  