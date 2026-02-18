export const ID = "docs-mf";
export { MENU } from "./menu";

import { BasePlugin } from "front-core";
import ACTIONS, { docsSourceActionId, presentDocs } from "./functions";
import { docsSourceKey, getDocsSources } from "./env";
import { anchorActionId, loadDocsSections } from "./sections";

class DocsPlugin extends BasePlugin {
  private sectionActionsLoaded = false;

  plug(bus: any) {
    super.plug(bus);
    if (this.sectionActionsLoaded) return;
    this.sectionActionsLoaded = true;

    void this.registerSectionActions(bus);
  }

  private async registerSectionActions(bus: any) {
    try {
      const sources = getDocsSources();
      for (const source of sources) {
        const sourceKey = docsSourceKey(source);

        bus.register({
          id: docsSourceActionId(sourceKey),
          description: `Open docs page ${source.name}`,
          invoke: () => {
            presentDocs(bus, source.id);
          },
        });

        const sections = await loadDocsSections(source.id);
        for (const section of sections) {
          const id = anchorActionId(sourceKey, section.anchor);
          bus.register({
            id,
            description: `Open docs section ${source.name}/${section.slug}`,
            invoke: () => {
              presentDocs(bus, source.id, section.anchor);
            },
          });
        }
      }
    } catch (error) {
      console.error("[mf-docs] Failed to register section actions", error);
    }
  }
}

export async function getMenu() {
  try {
    const sourceMenus = await Promise.all(
      getDocsSources().map(async (source) => {
        const sourceKey = docsSourceKey(source);
        let sections: Awaited<ReturnType<typeof loadDocsSections>> = [];

        try {
          sections = await loadDocsSections(source.id);
        } catch (error) {
          console.error(`[mf-docs] Failed to load sections for ${source.id}`, error);
        }

        return {
          title: source.name,
          key: sourceKey,
          action: docsSourceActionId(sourceKey),
          items: sections.map((section) => ({
            title: section.slug,
            key: section.anchor,
            action: anchorActionId(sourceKey, section.anchor),
          })),
        };
      }),
    );

    return {
      title: "Docs",
      iconName: "IconBook",
      items: sourceMenus,
    };
  } catch (error) {
    console.error("[mf-docs] Failed to build menu", error);
    return null;
  }
}

export default new DocsPlugin(ID, ACTIONS);
