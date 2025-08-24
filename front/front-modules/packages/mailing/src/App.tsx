import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Outgoing from './components/Outgoing';
import Incoming from './components/Incoming';
import Panel from './components/Panel';

const App = () => {
  return (
    <div>
      
      <Routes>
        {/* Убираем index роут, так как он будет конфликтовать с родительским */}
        <Route path="/" element={<Panel />} />
        <Route path="/outgoing" element={<Outgoing />} />
        <Route path="/incoming" element={<Incoming />} />
        <Route path="*" element={<div>Not Found in Mailing Module</div>} />
      </Routes>
    </div>
  );
};

export default App;