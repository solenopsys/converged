// App.tsx
import { Routes, Route } from 'react-router-dom';
import dagClient from './service';
import { TableView } from 'converged-core';
import { UniversalList } from 'converged-core';
import WorkflowLayout from './components/Layout';
import Versions from './panels/versions';
import WorkflowPanel from './panels/worflowPanel';
import Statistic from './components/Statistic';

// Функции загрузки данных
const loadCodeList = async () => {
  const res = await dagClient.codeSourceList();
  return res.names.map((name: string) => ({ id: name, title: name }));
};

const loadWorkflowList = async () => {
  const res = await dagClient.workflowList();
  return res.names.map((name: string) => ({ id: name, title: name }));
};

const loadVersions = async (codeName: string) => {
  const res = await dagClient.getCodeSourceVersions(codeName);
  return res.versions || [];
};

const loadWorkflow = async (codeName: string) => {
  const res = await dagClient.getCodeSourceVersions(codeName);
  return res.versions || [];
};

const App: React.FC = () => {
  return (
    <div className="mf-mailing h-screen">
      <Routes>
        <Route path="/" element={<Statistic />} />
        <Route path="/editor/:workflowName" element={<WorkflowLayout />} />
        <Route path="/editor/:workflowName/node/:nodeName" element={<WorkflowLayout />} />  
        <Route path="/nodes" element={<TableView />} />
        <Route path="/providers" element={<TableView />} />
        <Route path="/workflows/:name?" element={
          <UniversalList
            title="Рабочие процессы"
            basePath="/dag/workflows"          
          >
            <WorkflowPanel worflowLoader={loadWorkflow} />
          </UniversalList>
        } />
        <Route path="/code/:codeName?" element={      
          <UniversalList
            title="Исходные коды"
            basePath="/dag/code"
            dataLoader={loadCodeList}
          >
            <Versions versionLoader={loadVersions} />
          </UniversalList>
        } />
      </Routes>
    </div>
  );
};

export default App;