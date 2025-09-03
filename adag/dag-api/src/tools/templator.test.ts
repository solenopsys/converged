

//https://4ir.club?q=$.query
// bun test

import { test, expect } from "bun:test";

import { processTemplate } from "./templator";

 

test("processTemplate - basic replacement", () => {
	const template = "Hello {name}, welcome to {place}!";
	const data = { name: "John", place: "our website" };
	const result = processTemplate(template, data);
	
	expect(result).toBe("Hello John, welcome to our website!");
});

test("processTemplate - multiple occurrences of same key", () => {
	const template = "{name} loves {name}'s work on {project}";
	const data = { name: "Alice", project: "React" };
	const result = processTemplate(template, data);
	
	expect(result).toBe("Alice loves Alice's work on React");
});

test("processTemplate - no placeholders", () => {
	const template = "This is a plain text";
	const data = { name: "John" };
	const result = processTemplate(template, data);
	
	expect(result).toBe("This is a plain text");
});

test("processTemplate - empty data object", () => {
	const template = "Hello {name}, welcome to {place}!";
	const data = {};
	const result = processTemplate(template, data);
	
	expect(result).toBe("Hello {name}, welcome to {place}!");
});

test("processTemplate - empty template", () => {
	const template = "";
	const data = { name: "John" };
	const result = processTemplate(template, data);
	
	expect(result).toBe("");
});

test("processTemplate - placeholders without matching data", () => {
	const template = "Hello {name}, your age is {age}";
	const data = { name: "John" };
	const result = processTemplate(template, data);
	
	expect(result).toBe("Hello John, your age is {age}");
});

test("processTemplate - special characters in replacement", () => {
	const template = "Path: {filepath}";
	const data = { filepath: "/home/user/documents/file.txt" };
	const result = processTemplate(template, data);
	
	expect(result).toBe("Path: /home/user/documents/file.txt");
});

test("processTemplate - numbers and symbols in values", () => {
	const template = "Version: {version}, Price: {price}";
	const data = { version: "1.2.3", price: "$29.99" };
	const result = processTemplate(template, data);
	
	expect(result).toBe("Version: 1.2.3, Price: $29.99");
});

test("processTemplate - nested braces (should not replace)", () => {
	const template = "{{name}} and {name}";
	const data = { name: "John" };
	const result = processTemplate(template, data);
	
	expect(result).toBe("{John} and John");
});

test("processTemplate - complex template with multiple replacements", () => {
	const template = "Dear {title} {lastName}, your order #{orderId} for {product} has been {status}.";
	const data = {
		title: "Mr.",
		lastName: "Smith",
		orderId: "12345",
		product: "Laptop",
		status: "shipped"
	};
	const result = processTemplate(template, data);
	
	expect(result).toBe("Dear Mr. Smith, your order #12345 for Laptop has been shipped.");
});