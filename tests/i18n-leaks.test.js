'use strict';
// No English on a non-English client (docs/TRANSLATING.md, "English left on
// screen"). The addon runs in Russian and in Simplified Chinese with its
// shipped translations, names packs and guide texts, the client's own names
// as placeholders (tools/lib/i18n/leaks.lua), through a representative set of
// scenes: the guide window step by step on a starting zone (names as tokens),
// a zone with collect goals and a profession guide, every tooltip on it;
// every Options page and tab; the guide picker; and, where the Codex and the
// quest database are built, Lookup, Dungeons and Rares. A Latin word of three
// or more letters left on screen that is none of the locale's own words, not
// on tools/lib/i18n/leaks-allow.json and not a name no source has in the
// language (tools/lib/i18n/leaks-baseline.json) fails the test, named with
// its scene and the line that set it; so does a baseline name that no longer
// shows in English in scenes that all ran. `node tools/polestar.js i18n leaks`
// runs every scene in every locale.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../tools/lib/i18n/leaks');

const LOCALES = ['ruRU', 'zhCN'];
const SCENES = ['guide', 'options', 'picker', 'lookup', 'dungeons', 'rares'];

const describe = (r, l) => `${r.locale} ${r.scene}, ${l.scenes[0]}: "${l.text.length > 140 ? `${l.text.slice(0, 137)}...` : l.text}" (${l.words.join(', ')}; set at ${l.site[0] || '?'})`;

const runs = L.findLeaks(LOCALES, SCENES);
runs.catch(() => {}); // each test awaits it and fails on its error

for (const scene of SCENES) {
	const mine = async (t) => {
		const list = (await runs).filter((r) => r.scene === scene);
		if (list.every((r) => r.skipped)) t.skip(list[0].skipped);
		return list.filter((r) => !r.skipped);
	};
	test(`${scene}: the scene runs to the end and puts up its texts (${LOCALES.join(', ')})`, async (t) => {
		const list = await mine(t);
		const errors = list.flatMap((r) => r.errors.map((e) => `${r.locale} ${r.scene}: ${e.error}`));
		assert.deepEqual(errors, [], 'a scene stopped with an error, so it did not show everything');
		for (const r of list) assert.ok(r.texts > 10, `${r.locale} ${scene}: only ${r.texts} texts`);
	});
	test(`${scene}: every word on screen is in the client's language (${LOCALES.join(', ')})`, async (t) => {
		const leaks = (await mine(t)).flatMap((r) => r.leaks.map((l) => describe(r, l)));
		assert.equal(leaks.length, 0, `English on screen:\n${leaks.join('\n')}`);
	});
}

test(`the baseline lists only names that still show in English (${LOCALES.join(', ')}, the scenes above)`, async () => {
	const stale = L.staleBaseline(await runs).map((s) => `${s.locale} ${s.key} (${s.entry.scenes.join(', ')})`);
	assert.deepEqual(stale, [], 'these names no longer show in English: remove them from tools/lib/i18n/leaks-baseline.json');
});

// The check itself: English the code puts up is found, with its scene; the
// locale's own words (German shares the Latin alphabet), the client's names,
// the player's name, product names and slash commands are not.
test('English the code shows is found with its scene; the language, the client\'s names and the allowed names are not', () => {
	L.SCENES['test-english'] = {
		script: () => `
leaks.try("a test window", function()
	local f = CreateFrame("Frame", nil, UIParent)
	local fs = f:CreateFontString()
	fs:SetText("Kill ten wolves near the farm")
	fs:SetText(Polestar.L["Open settings"])
	fs:SetText(UnitName("player") .. " · " .. C_Map.GetMapInfo(1429).name .. " · Polestar · /polestar guides")
	GameTooltip:SetOwner(UIParent)
	GameTooltip:AddLine("Left-click to open")
end)`,
	};
	try {
		const r = L.checkRun('deDE', 'test-english', L.runScene('deDE', 'test-english'), L.loadAllow(), { classify: false });
		assert.deepEqual(r.errors, []);
		const mine = r.leaks.filter((l) => l.scenes.includes('a test window'));
		assert.deepEqual(mine.map((l) => [l.text, l.scenes[0]]), [
			['Kill ten wolves near the farm', 'a test window'],
			['Left-click to open', 'a test window'],
		]);
		assert.ok(mine[0].words.includes('wolves'), mine[0].words.join(', '));
	} finally {
		delete L.SCENES['test-english'];
	}
});
