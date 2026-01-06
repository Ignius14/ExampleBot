import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
	getLiveRates,
	getPriceEur,
	setPriceEur,
} from "../src/Services/pricingService.js";

const originalFetch = global.fetch;

const mockRates = {
	bitcoin: { eur: 60000 },
	ethereum: { eur: 3000 },
	litecoin: { eur: 90 },
	tether: { eur: 0.93 },
};

beforeEach(() => {
	global.fetch = async () => ({
		ok: true,
		json: async () => mockRates,
	});
});

afterEach(() => {
	global.fetch = originalFetch;
});

test("setPriceEur updates the stored EUR price", () => {
	setPriceEur(0.12);
	assert.equal(getPriceEur(), 0.12);
});

test("getLiveRates returns USD and coin EUR rates", async () => {
	const rates = await getLiveRates();
	assert.equal(rates.coinEur.btc, 60000);
	assert.equal(rates.coinEur.eth, 3000);
	assert.equal(rates.coinEur.ltc, 90);
	assert.ok(rates.usdPerEur > 0);
});
