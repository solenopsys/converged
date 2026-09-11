import { describe, expect, test } from "bun:test";
import { MessageType } from "g-threads";
import { encodeFileLink, parseFileLink } from "./link-codec";
import { mapThreadMessages, resolveParentId } from "./messages";

describe("link codec", () => {
	test("round-trips a file attachment", () => {
		const link = {
			fileId: "f1",
			fileName: "plan.pdf",
			fileSize: 12,
			fileType: "application/pdf",
		};
		expect(parseFileLink(encodeFileLink(link))).toMatchObject(link);
	});

	test("reads the historical nested shape", () => {
		const data = JSON.stringify({
			label: "plan.pdf",
			file: { fileId: "f1", fileName: "plan.pdf" },
		});
		expect(parseFileLink(data)?.fileId).toBe("f1");
	});

	test("a plain hyperlink is not an attachment", () => {
		expect(
			parseFileLink(JSON.stringify({ label: "docs", href: "/x" })),
		).toBeNull();
		expect(parseFileLink("not json")).toBeNull();
	});
});

describe("thread projection", () => {
	const messages = [
		{
			threadId: "t",
			id: "b",
			user: "u2",
			type: MessageType.message,
			data: "second",
			timestamp: 2,
			beforeId: "a",
		},
		{
			threadId: "t",
			id: "a",
			user: "u1",
			type: MessageType.message,
			data: "first",
			timestamp: 1,
		},
		{
			threadId: "t",
			user: "u1",
			type: MessageType.message,
			data: "unsaved",
			timestamp: 3,
		},
	];

	test("orders by time and drops messages without an id", () => {
		expect(mapThreadMessages(messages).map((entry) => entry.id)).toEqual([
			"a",
			"b",
		]);
	});

	test("the parent of a new message is the latest one", () => {
		expect(resolveParentId(messages)).toBe("b");
		expect(resolveParentId([])).toBeUndefined();
	});

	test("a link message carries its parsed file", () => {
		const [entry] = mapThreadMessages([
			{
				threadId: "t",
				id: "f",
				user: "u1",
				type: MessageType.link,
				data: encodeFileLink({ fileId: "f1", fileName: "a.pdf" }),
				timestamp: 1,
			},
		]);
		expect(entry.file?.fileId).toBe("f1");
	});
});
