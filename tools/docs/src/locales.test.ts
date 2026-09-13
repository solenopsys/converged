import { expect, test } from "bun:test";
import { isLocale } from "./locales";

test("accepts language codes", () => {
	for (const name of ["en", "ru", "de", "es", "fr", "it", "pt", "ukr"]) {
		expect(isLocale(name)).toBe(true);
	}
});

test("rejects the build's own output formats", () => {
	// These are the names that used to slip through a bare shape test and
	// travel the pipeline as languages.
	for (const name of ["pdf", "html"]) expect(isLocale(name)).toBe(false);
});

test("rejects anything that is not a bare code", () => {
	for (const name of ["struct", "markdown", "landings", "EN", "en-US", ""]) {
		expect(isLocale(name)).toBe(false);
	}
});
