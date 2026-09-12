import { AccessTagsMigration } from "back-core";
import createGaleries from "./createGaleries";
import createGaleryImages from "./createGaleryImages";

// One tag relation for both tables: gallery and image ids are ULIDs from the
// same generator, so they cannot collide and the `JOIN` tells them apart.
export default [createGaleries, createGaleryImages, AccessTagsMigration];
