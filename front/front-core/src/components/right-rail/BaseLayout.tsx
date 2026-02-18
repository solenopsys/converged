"use client";

import { useEffect, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { useUnit } from "effector-react";
import {
  $activePanel,
  $collapsed,
  $constrained,
  $device,
  $panelConfig,
  $parallel,
  setActivePanel,
  setCollapsed,
  setConstrained,
  setDevice,
  toggleParallel,
} from "./panelController";
import { ChatPanel, TabsPanel } from "./RightRailPanels";
import { $centerView } from "../../slots/present";
import { SlotProvider } from "../../slots/SlotProvider";

function CenterContent({ fallback }: { fallback?: ReactNode }) {
  const centerView = useUnit($centerView);

  if (centerView) {
    const View = centerView.view;
    return <View {...centerView.config} />;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return <Outlet />;
}

export function BaseLayout({ centerFallback }: { centerFallback?: ReactNode } = {}) {
  const {
    device,
    activePanel,
    collapsed,
    parallel,
    constrained,
    panelConfig,
    onDevice,
    onFront,
    onCollapsed,
    onConstrain,
    onParallel,
  } = useUnit({
    device: $device,
    activePanel: $activePanel,
    collapsed: $collapsed,
    constrained: $constrained,
    parallel: $parallel,
    panelConfig: $panelConfig,
    onDevice: setDevice,
    onFront: setActivePanel,
    onCollapsed: setCollapsed,
    onConstrain: setConstrained,
    onParallel: toggleParallel,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(max-width: 980px)");
    const apply = () => onDevice(media.matches ? "mobile" : "desktop");
    apply();
    if (media.addEventListener) {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
    media.addListener(apply);
    return () => media.removeListener(apply);
  }, [onDevice]);

  const handleToggleCollapse = () => {
    if (constrained) {
      return;
    }
    const next = !collapsed;
    onCollapsed(next);
    if (next) {
      onFront(device === "desktop" ? "tabs" : "chat");
    }
  };

  const handleToggleConstrain = () => {
    onConstrain(!constrained);
  };

  const handlePanelClick = (panel: ActivePanel) => {
    if (collapsed) {
      onCollapsed(false);
    }
    onFront(panel);
  };

  return (
    <div
      className="app-layout"
      data-device={device}
      data-front={activePanel}
      data-mode={parallel ? "parallel" : "stacked"}
      data-collapsed={collapsed ? "true" : "false"}
      data-constrained={constrained ? "true" : "false"}
    >
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap");

        :root {
          color-scheme: light;
        }

        .app-layout {
          --tabs-surface: var(--ui-card);
          --tabs-ink: var(--ui-card-foreground);
          --tabs-chip-surface: var(--ui-secondary);
          --tabs-chip-ink: var(--ui-secondary-foreground);
          --chat-surface: color-mix(in oklch, var(--ui-card) 70%, var(--ui-muted));
          --chat-ink: var(--ui-foreground);
          --chat-input-surface: var(--ui-secondary);
          --chat-input-ink: var(--ui-secondary-foreground);
          --panel-edge: var(--ui-border);
          --panel-shadow: var(--shadow-lg);
          --app-backdrop: var(--ui-background);
          --panel-header-height: 52px;
          --rail-padding: 4px;
          --panel-width: 390px;
          --stack-width: var(--panel-width);
          --rail-width: calc(var(--stack-width) + var(--rail-padding) * 2);
          --panel-height: calc(100vh - var(--rail-padding) * 2);
          --stack-tabs-height: calc(var(--panel-height) * 0.5);
          --stack-chat-height: calc(var(--panel-height) * 0.6);
          --stack-chat-offset: calc(var(--panel-height) * 0.4);
          --collapsed-width: 42px;
          --collapsed-chat-offset: 4px;
          --collapsed-overlap: 8px;
          --collapsed-chat-height: calc(var(--collapsed-width) + var(--collapsed-overlap));
          --mobile-collapsed-chat-height: 48px;
          --mobile-collapsed-chat-offset: 4px;
          --mobile-collapsed-tabs-height: 52px;
          --mobile-collapsed-overlap: 4px;
          --transition: 420ms cubic-bezier(0.16, 1, 0.3, 1);

          height: 100vh;
          min-height: 100vh;
          overflow: hidden;
          background: var(--app-backdrop);
        }

        .app-layout[data-constrained="true"] {
          --shell-max: 1400px;
        }

        .app-layout[data-constrained="false"] {
          --shell-max: 100%;
        }

        .app-shell {
          max-width: var(--shell-max);
          width: 100%;
          margin: 0 auto;
          height: 100%;
        }

        body {
          margin: 0;
          background: var(--app-backdrop);
        }

        .app-stage {
          display: grid;
          grid-template-columns: minmax(0, 1fr) var(--rail-width);
          gap: 0px;
          align-items: stretch;
          height: 100%;
          min-height: 100vh;
          transition: grid-template-columns var(--transition);
        }

        .app-content {
          min-width: 0;
          min-height: 0;
          height: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .app-center {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .app-rail {
          position: sticky;
          top: 0;
          align-self: start;
          width: var(--rail-width);
          height: 100%;
          min-height: 100vh;
          transition: width var(--transition);
          font-family: "Space Grotesk", "Segoe UI", sans-serif;
          padding: var(--rail-padding);
          box-sizing: border-box;
        }

        .panel-stack {
          position: relative;
          width: var(--stack-width);
          height: var(--panel-height);
          margin-left: auto;
          transition: width var(--transition), height var(--transition);
        }

        .panel {
          position: absolute;
          right: 0;
          top: 0;
          border-radius: 4px;
          border: 1px solid var(--panel-edge);
          box-shadow: var(--panel-shadow);
          transition:
            transform var(--transition),
            width var(--transition),
            height var(--transition),
            opacity var(--transition);
          overflow: hidden;
          cursor: pointer;
        }

        .tabs-panel {
          background: var(--tabs-surface);
          color: var(--tabs-ink);
        }

        .chat-panel {
          background: var(--chat-surface);
          color: var(--chat-ink);
          transition:
            transform var(--transition),
            width var(--transition),
            opacity var(--transition);
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 12px 12px 18px;
          font-size: 12px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          min-height: var(--panel-header-height);
        }

        .panel-brand {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .panel-logo {
          height: 18px;
          width: auto;
          display: block;
        }

        .panel-logo-light {
          display: none;
        }

        .dark .panel-logo-light {
          display: block;
        }

        .dark .panel-logo-dark {
          display: none;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .header-icons {
          display: flex;
          gap: 8px;
        }

        .header-icons:empty {
          display: none;
        }

        .panel-icon-button {
          width: 28px;
          height: 28px;
          padding: 0;
          color: color-mix(in oklch, currentColor 82%, transparent);
        }

        .panel-icon {
          width: 16px;
          height: 16px;
        }

        .panel-control-button.is-parallel,
        .panel-control-button.is-constrained,
        .panel-control-button.is-collapsed {
          box-shadow: inset 0 0 0 1px var(--panel-edge);
        }

        .tabs-body {
          padding: 10px 12px 14px;
        }

        .panel-tab-content {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .panel-tab-slot {
          flex: 1;
          min-height: 0;
          overflow: auto;
        }

        .panel-menu-provider {
          display: block;
          min-height: 0;
          width: 100%;
          background: transparent;
        }

        .panel-menu {
          min-height: 0;
          width: 100%;
        }

        .panel-menu [data-sidebar="group"] {
          padding: 6px 4px;
        }

        .panel-separator {
          background-color: var(--panel-edge);
          margin: 8px 0;
          height: 1px;
        }

        .panel-separator-tight {
          margin: 0;
        }

        .app-layout[data-collapsed="true"] .panel-separator {
          display: none;
        }

        .chat-body-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          min-height: 0;
        }

        .chat-panel-content .chat-body-wrapper {
          margin-top: auto;
        }

        .chat-body {
          padding: 20px 18px 16px;
          font-size: 14px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .chat-body-title {
          font-weight: 600;
          font-size: 16px;
          color: var(--chat-ink);
        }

        .chat-body-subtitle {
          font-size: 13px;
          line-height: 1.4;
          color: color-mix(in oklch, var(--chat-ink) 70%, transparent);
        }

        .chat-quick {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
          padding: 0 0 12px;
        }

        .chat-quick-button {
          border-radius: 999px;
          padding: 8px 14px;
          height: auto;
          font-size: 13px;
          font-weight: 500;
          color: var(--chat-ink);
          border-color: color-mix(in oklch, var(--chat-ink) 20%, transparent);
          background: color-mix(in oklch, var(--chat-surface) 85%, white);
          text-transform: none;
          gap: 8px;
        }

        .chat-quick-button:hover {
          background: color-mix(in oklch, var(--chat-surface) 75%, white);
        }

        .chat-input {
          margin-top: 0;
          padding: 12px 16px;
          background: var(--chat-input-surface);
          color: var(--chat-input-ink);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: none;
        }

        .chat-footer {
          margin-top: auto;
          display: flex;
          flex-direction: column;
        }

        .chat-input-actions {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }

        .panel-action-button {
          border: 1px solid var(--panel-edge);
          background: transparent;
        }

        .panel-content {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .chat-panel-content {
          position: relative;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }

        .chat-panel-runtime {
          flex: 1;
          min-height: 0;
          display: flex;
        }

        .chat-panel-runtime [data-slot="card"] {
          background: transparent;
          border: none;
          box-shadow: none;
          padding-top: 0;
          padding-bottom: 0;
        }

        .chat-panel-runtime [data-slot="card-footer"] {
          background: var(--chat-input-surface);
          color: var(--chat-input-ink);
          border-top: 1px solid color-mix(in oklch, var(--chat-ink) 10%, transparent);
        }

        .panel-chat-button {
          display: none;
        }

        .app-layout[data-device="desktop"] {
          --stack-width: var(--panel-width);
          --rail-width: calc(var(--stack-width) + var(--rail-padding) * 2);
        }

        .app-layout[data-device="desktop"][data-mode="stacked"]:not([data-collapsed="true"]) .tabs-panel {
          width: var(--panel-width);
          height: auto;
          max-height: var(--panel-height);
          transform: translate(0, 0);
        }

        .app-layout[data-device="desktop"][data-mode="stacked"]:not([data-collapsed="true"]) .chat-panel {
          width: var(--panel-width);
          height: calc(var(--panel-height) - var(--panel-header-height));
          top: var(--panel-header-height);
          transform: translate(0, 0);
        }

        .app-layout[data-device="desktop"][data-mode="parallel"][data-collapsed="false"] {
          --panel-overlap: 8px;
          --stack-width: calc(var(--panel-width) * 2 - var(--panel-overlap));
          --rail-width: calc(var(--stack-width) + var(--rail-padding) * 2);
        }

        .app-layout[data-device="desktop"][data-mode="parallel"][data-collapsed="false"] .panel {
          border-radius: 4px;
        }

        .app-layout[data-device="desktop"][data-mode="parallel"][data-collapsed="false"] .tabs-panel {
          width: var(--panel-width);
          height: var(--panel-height);
          top: 0;
          transform: translate(0, 0);
        }

        .app-layout[data-device="desktop"][data-mode="parallel"][data-collapsed="false"] .chat-panel {
          width: var(--panel-width);
          height: var(--panel-height);
          top: 0;
          transform: translate(calc(-1 * (var(--panel-width) - var(--panel-overlap))), 0);
        }

        .app-layout[data-device="desktop"][data-collapsed="true"] {
          --stack-width: var(--collapsed-width);
          --rail-width: calc(var(--stack-width) + var(--rail-padding) * 2);
        }

        .app-layout[data-device="desktop"][data-collapsed="true"] .tabs-panel {
          width: var(--collapsed-width);
          height: calc(
            var(--panel-height) -
              (var(--collapsed-chat-height) - var(--collapsed-chat-offset)) +
              var(--collapsed-overlap)
          );
          transform: translate(0, 0);
        }

        .app-layout[data-device="desktop"][data-collapsed="true"] .chat-panel {
          width: var(--collapsed-width);
          height: var(--collapsed-chat-height);
          top: calc(
            var(--panel-height) - var(--collapsed-chat-height)
          );
          transform: translate(0, 0);
        }

        .app-layout[data-device="desktop"][data-collapsed="true"] .tabs-body,
        .app-layout[data-device="desktop"][data-collapsed="true"] .chat-body,
        .app-layout[data-device="desktop"][data-collapsed="true"] .chat-quick,
        .app-layout[data-device="desktop"][data-collapsed="true"] .chat-input {
          display: none;
        }

        .app-layout[data-collapsed="true"] .chat-panel-runtime {
          display: none;
        }

        .app-layout[data-device="desktop"][data-collapsed="true"] .panel-header {
          justify-content: center;
          padding: 10px;
        }

        .app-layout[data-device="desktop"][data-collapsed="true"] .header-icons,
        .app-layout[data-device="desktop"][data-collapsed="true"] .tabs-title {
          display: none;
        }

        .app-layout[data-device="desktop"][data-collapsed="true"] .header-right {
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .app-layout[data-device="desktop"][data-collapsed="true"] .panel-control-collapse {
          order: 1;
        }

        .app-layout[data-device="desktop"][data-collapsed="true"] .panel-control-constrain {
          order: 2;
        }

        .app-layout[data-device="desktop"][data-collapsed="true"] .panel-control-parallel {
          order: 3;
        }

        .app-layout[data-device="desktop"][data-collapsed="true"] .panel-control-theme {
          order: 4;
        }

        .app-layout[data-device="desktop"][data-collapsed="true"] .chat-panel {
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          padding: 6px;
          box-sizing: border-box;
        }

        .app-layout[data-device="desktop"][data-collapsed="true"] .chat-panel .panel-chat-button {
          display: inline-flex;
        }

        .app-layout[data-device="mobile"] {
          --rail-width: 0px;
          --stack-width: calc(100vw - var(--rail-padding) * 2);
          --panel-width: var(--stack-width);
          --shell-max: 100%;
        }

        .app-layout[data-device="mobile"] .app-stage {
          grid-template-columns: 1fr;
          position: relative;
        }

        .app-layout[data-device="mobile"] .app-rail {
          position: fixed;
          right: var(--rail-padding);
          left: var(--rail-padding);
          bottom: var(--rail-padding);
          top: auto;
          width: auto;
          height: auto;
          z-index: 5;
          pointer-events: none;
          padding: 0;
        }

        .app-layout[data-device="mobile"] .panel {
          pointer-events: auto;
        }

        .app-layout[data-device="mobile"] .parallel-button {
          display: none;
        }

        .app-layout[data-device="mobile"] .constrain-button {
          display: none;
        }

        .app-layout[data-device="mobile"][data-mode="stacked"]:not([data-collapsed="true"]) .tabs-panel {
          width: var(--stack-width);
          height: auto;
          max-height: var(--panel-height);
          transform: translate(0, 0);
        }

        .app-layout[data-device="mobile"][data-mode="stacked"]:not([data-collapsed="true"]) .chat-panel {
          width: var(--stack-width);
          height: calc(var(--panel-height) - var(--panel-header-height));
          top: var(--panel-header-height);
          transform: translate(0, 0);
        }

        .app-layout[data-device="mobile"][data-collapsed="true"] .tabs-panel {
          width: var(--stack-width);
          height: var(--mobile-collapsed-tabs-height);
          transform: translate(
            0,
            calc(
              var(--panel-height) -
                (var(--mobile-collapsed-chat-height) - var(--mobile-collapsed-chat-offset)) +
                var(--mobile-collapsed-overlap) - var(--mobile-collapsed-tabs-height)
            )
          );
        }

        .app-layout[data-device="mobile"][data-collapsed="true"] .chat-panel {
          width: var(--stack-width);
          height: var(--mobile-collapsed-chat-height);
          top: calc(
            var(--panel-height) -
              var(--mobile-collapsed-chat-height) +
              var(--mobile-collapsed-chat-offset)
          );
          transform: translate(0, 0);
        }

        .app-layout[data-device="mobile"][data-collapsed="true"] .tabs-body,
        .app-layout[data-device="mobile"][data-collapsed="true"] .chat-body,
        .app-layout[data-device="mobile"][data-collapsed="true"] .chat-quick {
          display: none;
        }

        .app-layout[data-device="mobile"][data-collapsed="true"] .chat-input {
          margin-top: 0;
        }

        .app-layout[data-front="tabs"] .tabs-panel {
          z-index: 3;
        }

        .app-layout[data-front="tabs"] .chat-panel {
          z-index: 1;
        }

        .app-layout[data-front="chat"] .tabs-panel {
          z-index: 1;
        }

        .app-layout[data-front="chat"] .chat-panel {
          z-index: 3;
        }

      `}</style>
      <SlotProvider>
        <div className="app-shell">
          <div className="app-stage">
            <main className="app-content">
              <div className="app-center">
                <CenterContent fallback={centerFallback} />
              </div>
            </main>
            <aside className="app-rail">
              <div className="panel-stack">
                <TabsPanel
                  {...panelConfig.tabs}
                  collapsed={collapsed}
                  onToggleCollapse={constrained ? undefined : handleToggleCollapse}
                  parallel={parallel}
                  onToggleParallel={constrained ? undefined : onParallel}
                  constrained={constrained}
                  onToggleConstrain={handleToggleConstrain}
                  onClick={() => handlePanelClick("tabs")}
                />
                <ChatPanel
                  {...panelConfig.chat}
                  onClick={() => handlePanelClick("chat")}
                />
              </div>
            </aside>
          </div>
        </div>
      </SlotProvider>
    </div>
  );
}
