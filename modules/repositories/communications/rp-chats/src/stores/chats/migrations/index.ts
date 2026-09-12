import { AccessTagsMigration } from "back-core";
import addRoomSummary from "./addRoomSummary";
import addRoomVisibility from "./addRoomVisibility";
import createRooms from "./createRooms";
import createRoomUsers from "./createRoomUsers";

// The shared tag table from `back-core`. Rooms are what it covers: membership
// is a `u-<userId>` tag on the room, while `chart_room_users` stays on as the
// carrier of the role (`owner | admin | member`), which no tag expresses.
export default [
	createRooms,
	createRoomUsers,
	addRoomSummary,
	addRoomVisibility,
	AccessTagsMigration,
];
