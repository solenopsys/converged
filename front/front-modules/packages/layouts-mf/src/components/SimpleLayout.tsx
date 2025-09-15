import { ReactNode } from "react";
import { Slot } from "converged-core";

export const SimpleLayout = ({ 
  children, 
  basePath = "simple" 
}: { 
  children?: ReactNode; 
  basePath?: string; 
}) => {
  return (
    <div className="min-h-screen w-full bg-background">
      <main className="w-full">
        <Slot id={`${basePath}:center`} />
      </main>
      {children}
    </div>
  );
};