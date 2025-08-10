
import  { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import {GraphRenderer} from './Renderer';

const App: React.FC = () => {
    const [filePath, setFilePath] = useState('');
  
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Graph Component Demo</h1>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Путь к JSON файлу:
          </label>
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="/path/to/workflow.json"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
  
        <GraphRenderer filePath={filePath} />
      </div>
    );
  };
  
  export default App;