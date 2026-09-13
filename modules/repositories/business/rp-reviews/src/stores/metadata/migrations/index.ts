import { AccessTagsMigration } from "back-core";
import createReviewInvites from "./createReviewInvites";
import createReviewSettings from "./createReviewSettings";
import createReviews from "./createReviews";
import extendReviews from "./extendReviews";

// One tag relation for the store, added last so every table already exists.
export default [
	createReviews,
	extendReviews,
	createReviewInvites,
	createReviewSettings,
	AccessTagsMigration,
];
