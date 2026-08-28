import React from 'preact/compat';
import { useMicrofrontendTranslation } from 'front-core';

const MF_ID = 'dag-mf';

interface Version {
  version: string;
}

interface VersionsViewProps {
  versions: Version[];
  loading: boolean;
  codeName: string;
}

export const Versions: React.FC<VersionsViewProps> = ({
  versions,
  loading,
  codeName
}) => {
  const { t } = useMicrofrontendTranslation(MF_ID);

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">{t('versions.loading') as string}</div>
      </div>
    );
  }

  if (!codeName) {
    return (
      <div className="p-4 text-muted-foreground">
        {t('versions.selectCode') as string}
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
          {t('versions.empty') as string}
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