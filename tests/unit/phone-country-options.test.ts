import { getCountryCallingCode, type CountryCode } from "libphonenumber-js/max";
import { describe, expect, it } from "vitest";
import {
  phoneCountries,
  sortCountriesByCallingCode,
} from "../../src/pages/Register/components/phoneCountryOptions";

function callingCode(country: CountryCode) {
  return Number(getCountryCallingCode(country));
}

describe("phoneCountryOptions", () => {
  it("sorts countries by numeric calling code ascending", () => {
    for (let index = 1; index < phoneCountries.length; index += 1) {
      const previous = callingCode(phoneCountries[index - 1]!);
      const current = callingCode(phoneCountries[index]!);
      expect(current).toBeGreaterThanOrEqual(previous);
    }
  });

  it("orders lower numeric codes before higher ones, not lexicographically", () => {
    const sorted = sortCountriesByCallingCode(["EG", "RU", "US"] as const);
    expect(sorted).toEqual(["US", "RU", "EG"]);
    expect(callingCode("RU")).toBe(7);
    expect(callingCode("EG")).toBe(20);
    expect(callingCode("US")).toBe(1);
  });

  it("alphabetizes countries that share the same calling code", () => {
    const sorted = sortCountriesByCallingCode(["US", "CA"] as const);
    expect(sorted).toEqual(["CA", "US"]);
  });

  it("includes expected example countries in numeric order", () => {
    const indices = Object.fromEntries(
      (["US", "RU", "EG", "ZA", "GR", "FR", "GB", "IN"] as const).map((country) => [
        country,
        phoneCountries.indexOf(country),
      ]),
    );

    expect(indices.US).toBeGreaterThanOrEqual(0);
    expect(indices.RU).toBeGreaterThan(indices.US!);
    expect(indices.EG).toBeGreaterThan(indices.RU!);
    expect(indices.ZA).toBeGreaterThan(indices.EG!);
    expect(indices.GR).toBeGreaterThan(indices.ZA!);
    expect(indices.FR).toBeGreaterThan(indices.GR!);
    expect(indices.GB).toBeGreaterThan(indices.FR!);
    expect(indices.IN).toBeGreaterThan(indices.GB!);
  });
});
