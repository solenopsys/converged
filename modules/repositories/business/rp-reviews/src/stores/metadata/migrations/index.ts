import { AccessTagsMigration } from "back-core";
import createReviews from "./createReviews";

// One tag relation for the store, added last so `reviews` already exists.
export default [createReviews, AccessTagsMigration];
