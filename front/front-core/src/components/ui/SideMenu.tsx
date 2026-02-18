import { X } from "lucide-react";
import { cn } from "../../lib/utils";

const SideMenuSimple = ({ isOpen, onClose, children }) => {
    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40 transition-opacity"
                    onClick={onClose}
                />
            )}

            <div className={`fixed right-0 top-0 h-full w-80 bg-background shadow-xl border-l z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}>

                {children}
            </div>
        </>
    )
}
// Боковое меню
const SideMenu = ({ selectedRows, bulkActions, onBulkAction, isOpen, onClose, title = "Операции" }) => {
    return (
        <>
            <SideMenuSimple isOpen={isOpen} onClose={onClose}>
                <div className="flex items-center justify-between p-4 border-b bg-muted/50">
                    <div>
                        <h3 className="font-semibold">{title}</h3>
                        {selectedRows.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                                Выбрано: {selectedRows.length}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-accent rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4">
                    <div className="space-y-2">
                        {bulkActions.map(action => (
                            <button
                                key={action.id}
                                onClick={() => onBulkAction(action.id, selectedRows)}
                                disabled={selectedRows.length === 0}
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
                                    selectedRows.length === 0 ? [
                                        "bg-muted text-muted-foreground cursor-not-allowed border-border"
                                    ] : [
                                        "hover:bg-accent border-border",
                                        action.variant === 'danger' && "hover:bg-destructive/10 hover:border-destructive/20"
                                    ]
                                )}
                            >
                                {action.icon && (
                                    <action.icon className={cn(
                                        "h-4 w-4",
                                        selectedRows.length === 0 ? "text-muted-foreground" :
                                            action.variant === 'danger' ? "text-destructive" : "text-foreground"
                                    )} />
                                )}
                                <span className="text-sm font-medium">{action.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </SideMenuSimple>
        </>
    );
};

export  {SideMenu,SideMenuSimple};
