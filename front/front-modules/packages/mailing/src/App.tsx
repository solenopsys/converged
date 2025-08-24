import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Hello from './components/Hello';
import World from './components/World';
import Panel from './Panel';

const App = () => {
  return (
    <div>
      <nav>
        <ul>
          <li>
            <Link to="/mailing/outgoing">Hello</Link>
          </li>
          <li>
            <Link to="/mailing/incoming">World</Link>
          </li>
        </ul>
      </nav>
      <Routes>
        {/* Убираем index роут, так как он будет конфликтовать с родительским */}
        <Route path="/" element={<Panel />} />
        <Route path="/outgoing" element={<Hello />} />
        <Route path="/incoming" element={<World />} />
        <Route path="*" element={<div>Not Found in Mailing Module</div>} />
      </Routes>
    </div>
  );
};

export default App;