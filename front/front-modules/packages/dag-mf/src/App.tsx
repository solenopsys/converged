import { useState } from 'react'; 

import  dagClient  from './service';
import JsonExample from './JsonViewer';
import DagViewer from './Dag';
import ControlPanel from './Control';

const App: React.FC = () => {
  const [filePath, setFilePath] = useState('');

  dagClient.codeSourceList().then((res) => {
    console.log(res);
  });

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">DAG</h1>

      <ControlPanel></ControlPanel>
      <DagViewer></DagViewer>
      
       <JsonExample></JsonExample>
    </div>
  );
};

export default App;