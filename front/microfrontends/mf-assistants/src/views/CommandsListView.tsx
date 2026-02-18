import React, { useState } from "react";
import { useUnit } from "effector-react";
import { HeaderPanel } from "front-core";
import { RefreshCw, Play, Search } from "lucide-react";
import {
  $registeredCommands,
  executeCommandClicked,
  refreshCommandsClicked,
  $commandsFilter,
  setCommandsFilter,
} from "../domain-commands";

export const CommandsListView = ({ bus: _bus }) => {
  const commands = useUnit($registeredCommands);
  const filter = useUnit($commandsFilter);
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null);

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.id.toLowerCase().includes(filter.toLowerCase()) ||
      cmd.description.toLowerCase().includes(filter.toLowerCase())
  );

  const handleExecute = (commandId: string) => {
    executeCommandClicked({ commandId });
  };

  const headerConfig = {
    title: "Commands",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshCommandsClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />

      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search commands..."
            value={filter}
            onChange={(e) => setCommandsFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="text-sm text-muted-foreground mb-4">
          {filteredCommands.length} commands available
        </div>

        <div className="space-y-2">
          {filteredCommands.map((command) => (
            <div
              key={command.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedCommand === command.id
                  ? "bg-primary/10 border-primary"
                  : "hover:bg-muted/50"
              }`}
              onClick={() => setSelectedCommand(command.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-mono text-sm font-medium">
                    {command.id}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {command.description}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExecute(command.id);
                  }}
                  className="ml-4 p-2 rounded-md hover:bg-primary/20 text-primary"
                  title="Execute command"
                >
                  <Play className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredCommands.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No commands found
          </div>
        )}
      </div>

      <div className="border-t bg-muted/30 p-4">
        <div className="text-sm font-semibold mb-2">AI Function Interface</div>
        <pre className="text-xs bg-background p-3 rounded-md overflow-auto max-h-40">
{`executeCommand({
  commandId: "${selectedCommand || "command.id"}"
})`}
        </pre>
        <div className="text-xs text-muted-foreground mt-2">
          Use this function from AI chat to execute UI commands
        </div>
      </div>
    </div>
  );
};
