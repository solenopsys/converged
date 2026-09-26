import type { EventsServiceClient } from "g-events";
import type { PushRouterServiceClient } from "g-pushrouter";
import type { StaffServiceClient } from "g-staff";
import type { RequestInput } from "./types";

type Delivery = {
	staff: Pick<StaffServiceClient, "listStaff">;
	events: Pick<EventsServiceClient, "publish">;
	push: Pick<PushRouterServiceClient, "publish">;
	grant: (userId: string) => Promise<void>;
};

async function report(
	stage: string,
	requestId: string,
	action: () => Promise<unknown>,
) {
	try {
		await action();
	} catch (error) {
		console.warn(`[rp-requests] ${stage} failed`, requestId, error);
	}
}

/** One canonical announcement covers chat, public intake and console creation. */
export async function announceRequestCreated(
	requestId: string,
	input: RequestInput,
	actor: string,
	delivery: Delivery,
): Promise<void> {
	await report("journal", requestId, () =>
		delivery.events.publish({
			type: "request.created",
			service: "requests",
			entityId: requestId,
			label: input.title?.trim() || undefined,
		}),
	);

	const recipients = new Set<string>();
	try {
		let offset = 0;
		const limit = 100;
		while (true) {
			const page = await delivery.staff.listStaff({
				offset,
				limit,
				active: true,
			});
			for (const member of page.items) {
				const userId = member.userId?.trim();
				if (member.active && userId && userId !== actor) recipients.add(userId);
			}
			offset += page.items.length;
			if (page.items.length < limit || offset >= (page.totalCount ?? Infinity))
				break;
		}
	} catch (error) {
		console.warn("[rp-requests] staff lookup failed", requestId, error);
		return;
	}

	await Promise.all(
		[...recipients].map(async (userId) => {
			try {
				await delivery.grant(userId);
			} catch (error) {
				console.warn(
					"[rp-requests] staff access grant failed",
					requestId,
					userId,
					error,
				);
				return;
			}
			await report("staff notification", requestId, () =>
				delivery.push.publish({
					name: "request.created",
					user: userId,
					level: "info",
					titleKey: "notify.requestCreated.title",
					bodyKey: "notify.requestCreated.body",
					params: { id: requestId },
					link: {
						surface: "requests",
						ref: requestId,
						href: `/console/request/${encodeURIComponent(requestId)}`,
					},
				}),
			);
		}),
	);
}
