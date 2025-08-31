import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface Workflow {
  version: string;
}

interface CompProps {
  worflowLoader?: (codeName: string) => Promise<Workflow[]>;
}

const WorkflowPanel: React.FC<CompProps> = ({ worflowLoader }) => {
  const [versions, setVersions] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  
  const { codeName } = useParams<{ codeName: string }>();

  useEffect(() => {
    if (!codeName || !worflowLoader) return;

    const fetchVersions = async () => {
      setLoading(true);
      
      try {
        const data = await worflowLoader(codeName);
        setVersions(data);
      } catch (error) {
        console.error('Error fetching versions:', error);
        setVersions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVersions();
  }, [codeName, worflowLoader]);

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">Загрузка версий...</div>
      </div>
    );
  }

  if (!codeName) {
    return (
      <div className="p-4 text-muted-foreground">
        Выберите код из списка
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">
        Versions for {codeName}
      </h3>
      
      {versions.length === 0 ? (
        <div className="text-muted-foreground">
          Нет доступных версий
        </div>
      ) : (
        <div className="space-y-2">
          {versions.map((version) => (
            <div 
              key={version.version}
              className="p-3 border rounded-md bg-card hover:bg-accent transition-colors"
            >
              <span className="font-medium">v{version.version}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowPanel;