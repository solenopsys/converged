import type { CaseLanguage } from "assistant-state";

/**
 * Localized examples for ordinary assistant questions. These are routing
 * examples, not user-facing copy; keep them representative and specific so
 * module actions still win for requests that ask the assistant to do work.
 */
export const CHAT_ANSWER_EXAMPLES: Partial<Record<CaseLanguage, string[]>> = {
	en: [
		"Tell me about this project",
		"What is this project about?",
		"What does this platform do?",
		"What can you help me with?",
		"What can this assistant do?",
		"How does this work?",
		"Explain this to me",
		"Give me an overview",
	],
	ru: [
		"Расскажи про проект",
		"Что это за проект?",
		"Расскажи о платформе",
		"Что умеет эта платформа?",
		"Что ты умеешь?",
		"Чем ты можешь помочь?",
		"Как это работает?",
		"Объясни, как это устроено",
		"Дай краткий обзор",
	],
	de: [
		"Erzähl mir von diesem Projekt",
		"Worum geht es bei diesem Projekt?",
		"Was kann diese Plattform?",
		"Wobei kannst du mir helfen?",
		"Was kannst du?",
		"Wie funktioniert das?",
		"Erklär mir das",
		"Gib mir einen Überblick",
	],
	fr: [
		"Parle-moi de ce projet",
		"De quoi parle ce projet ?",
		"Que fait cette plateforme ?",
		"En quoi peux-tu m'aider ?",
		"Que sais-tu faire ?",
		"Comment ça fonctionne ?",
		"Explique-moi cela",
		"Donne-moi un aperçu",
	],
	es: [
		"Cuéntame sobre este proyecto",
		"¿De qué trata este proyecto?",
		"¿Qué hace esta plataforma?",
		"¿En qué puedes ayudarme?",
		"¿Qué sabes hacer?",
		"¿Cómo funciona esto?",
		"Explícame esto",
		"Dame una descripción general",
	],
	it: [
		"Parlami di questo progetto",
		"Di cosa tratta questo progetto?",
		"Cosa fa questa piattaforma?",
		"In cosa puoi aiutarmi?",
		"Cosa sai fare?",
		"Come funziona?",
		"Spiegami questo",
		"Fammi una panoramica",
	],
	pt: [
		"Fale-me sobre este projeto",
		"Sobre o que é este projeto?",
		"O que esta plataforma faz?",
		"Como você pode me ajudar?",
		"O que você sabe fazer?",
		"Como isso funciona?",
		"Explique isso para mim",
		"Dê-me uma visão geral",
	],
};
