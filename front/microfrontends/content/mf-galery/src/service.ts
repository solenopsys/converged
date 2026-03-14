import { galeryClient } from "g-galery";
import type { GaleryListRow, PaginationParams } from "./functions/types";

let cache: { at: number; rows: GaleryListRow[] } | null = null;
const CACHE_TTL_MS = 5000;

async function fetchAllRows(): Promise<GaleryListRow[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.rows;
  }

  const galleryLimit = 100;
  const galleries: any[] = [];
  let galleryOffset = 0;

  while (true) {
    const page = await galeryClient.listGaleries({ offset: galleryOffset, limit: galleryLimit });
    const items = Array.isArray(page?.items) ? page.items : [];
    galleries.push(...items);

    const total = typeof page?.totalCount === "number" ? page.totalCount : galleries.length;
    galleryOffset += items.length;
    if (items.length === 0 || galleryOffset >= total) {
      break;
    }
  }

  const rows: GaleryListRow[] = [];

  for (const gallery of galleries) {
    const imageLimit = 100;
    let imageOffset = 0;
    while (true) {
      const page = await galeryClient.listImages(gallery.id, {
        offset: imageOffset,
        limit: imageLimit,
      });
      const images = Array.isArray(page?.items) ? page.items : [];

      for (const image of images) {
        rows.push({
          galeryName: gallery.name ?? "",
          itemName: image.title || image.originalName || image.id,
        });
      }

      const total = typeof page?.totalCount === "number" ? page.totalCount : imageOffset + images.length;
      imageOffset += images.length;
      if (images.length === 0 || imageOffset >= total) {
        break;
      }
    }
  }

  cache = { at: Date.now(), rows };
  return rows;
}

async function listOfGaleryItems(params: PaginationParams): Promise<{ items: GaleryListRow[]; totalCount: number }> {
  const rows = await fetchAllRows();
  const start = params.offset ?? 0;
  const end = start + (params.limit ?? 50);
  return {
    items: rows.slice(start, end),
    totalCount: rows.length,
  };
}

function clearCache() {
  cache = null;
}

export default {
  listOfGaleryItems,
  clearCache,
};
