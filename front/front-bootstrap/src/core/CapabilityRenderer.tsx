import React, { useMemo } from 'react';
import { 
	Capability, 
	CapabilityContext, 
	ViewComponent, 
	CapabilityCommand,
	CommandContext,
	ViewProps 
} from './types';

interface CapabilityRendererProps {
	capability: Capability;
	context: CapabilityContext;
}

export const CapabilityRenderer: React.FC<CapabilityRendererProps> = ({ capability, context }) => {
	const { module, params, navigate } = context;

	// Обработчики команд
	const commandHandlers = useMemo(() => {
		if (!capability.commands) {
			return {};
		}

		const handlers: Record<string, (contextData?: CommandContext) => void> = {};
		
		Object.entries(capability.commands).forEach(([commandKey, command]: [string, CapabilityCommand]) => {
			handlers[commandKey] = (contextData: CommandContext = {}) => {
				try {
					// Подготавливаем параметры команды
					const commandParams: Record<string, any> = {};
					
					if (command.params) {
						Object.entries(command.params).forEach(([paramKey, paramValue]) => {
							if (typeof paramValue === 'string' && paramValue.includes('.')) {
								const [source, field] = paramValue.split('.');
								
								switch (source) {
									case 'row':
										commandParams[paramKey] = contextData.row?.[field];
										break;
									case 'params':
										commandParams[paramKey] = params[field];
										break;
									default:
										commandParams[paramKey] = paramValue;
								}
							} else {
								commandParams[paramKey] = paramValue;
							}
						});
					}

					// Выполняем команду
					if (typeof command.name === 'function') {
						command.name(commandParams, contextData);
					} else if (typeof command.name === 'string') {
						switch (command.name) {
							case 'navigate':
								if (commandParams.path) {
									navigate(commandParams.path, commandParams);
								}
								break;
							case 'open':
								const currentPath = window.location.pathname;
								const detailPath = `${currentPath}/${commandParams.mailid || commandParams.id}`;
								navigate(detailPath, commandParams);
								break;
							default:
								console.warn(`Unknown command: ${command.name}`);
						}
					}
				} catch (err: any) {
					console.error(`Command ${commandKey} execution failed:`, err);
				}
			};
		});

		return handlers;
	}, [capability.commands, params, navigate]);

	// Рендеринг на основе views
	const renderViews = (): React.ReactNode[] => {
		if (!capability.views || !Array.isArray(capability.views)) {
			return [<div key="no-views" className="p-4 text-gray-500">No views defined for this capability</div>];
		}

		return capability.views.map((ViewComponent: ViewComponent, index: number) => {
			if (!ViewComponent) {
				return <div key={index} className="p-4 text-red-500">Invalid view component</div>;
			}

			// Подготавливаем props для view компонента
			const viewProps: ViewProps = {
				params,
				config: capability.config || {},
				commands: commandHandlers,
				capability,
				context,
				dataSource: capability.dataSource,
			};

			try {
				return (
					<ViewComponent
						key={`${module.name}-${index}`}
						{...viewProps}
					/>
				);
			} catch (err) {
				console.error('Error rendering view component:', err);
				return <div key={index} className="p-4 text-red-500">Error rendering view: {String(err)}</div>;
			}
		});
	};

	// Основной рендер
	return (
		<div className="capability-container h-full">			
			{capability.description && (
				<div className="capability-header p-4 border-b bg-gray-50 dark:bg-gray-800">
					<h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
						{capability.description}
					</h2>
				</div>
			)}
			
			<div className="capability-content flex-1">
				{renderViews()}
			</div>
		</div>
	);
};