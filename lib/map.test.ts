import { filterProperties } from "./map";
import type { Property } from "@/types/database";
import type { MapFilters } from "@/types/domain";

const DEFAULT_FILTERS: MapFilters = { membership: "", sayor: null, lotSearch: "" };

const make = (overrides: Partial<Property>): Property => ({
  id: "test-id",
  lot_number: 1,
  first_name: "Jane",
  last_name: "Doe",
  account_number: null,
  street_address: null,
  membership: "Mandatory",
  membership_type: "Mandatory - Recreation",
  annual_lease_fee: null,
  has_annual_lease_fee: false,
  email_1: null,
  email_2: null,
  key_fob_1: null,
  key_fob_2: null,
  sayor: false,
  ...overrides,
});

const LOT_1 = make({ lot_number: 1, membership_type: "Mandatory - Recreation", sayor: false });
const LOT_2 = make({ lot_number: 2, membership_type: "Mandatory - Recreation", sayor: true });
const LOT_3 = make({ lot_number: 3, membership_type: "Non-Mandatory", sayor: false });
const LOT_10 = make({ lot_number: 10, membership_type: "Mandatory - Recreation", sayor: true });
const ALL = [LOT_1, LOT_2, LOT_3, LOT_10];

describe("filterProperties", () => {
  it("returns all rows when no filters are active and no lot is selected", () => {
    expect(filterProperties(ALL, DEFAULT_FILTERS, null)).toEqual(ALL);
  });

  it("returns exactly the selected lot when selectedLotId is set, ignoring other filters", () => {
    const filters: MapFilters = { membership: "Non-Mandatory", sayor: true, lotSearch: "99" };
    const result = filterProperties(ALL, filters, 2);
    expect(result).toEqual([LOT_2]);
  });

  it("returns empty array when selectedLotId does not match any lot", () => {
    expect(filterProperties(ALL, DEFAULT_FILTERS, 999)).toEqual([]);
  });

  it("filters by membership_type", () => {
    const filters: MapFilters = { ...DEFAULT_FILTERS, membership: "Non-Mandatory" };
    expect(filterProperties(ALL, filters, null)).toEqual([LOT_3]);
  });

  it("does not filter when membership is empty string", () => {
    expect(filterProperties(ALL, DEFAULT_FILTERS, null)).toHaveLength(4);
  });

  it("filters sayor: true to only SAYOR lots", () => {
    const filters: MapFilters = { ...DEFAULT_FILTERS, sayor: true };
    expect(filterProperties(ALL, filters, null)).toEqual([LOT_2, LOT_10]);
  });

  it("filters sayor: false to only non-SAYOR lots", () => {
    const filters: MapFilters = { ...DEFAULT_FILTERS, sayor: false };
    expect(filterProperties(ALL, filters, null)).toEqual([LOT_1, LOT_3]);
  });

  it("does not filter SAYOR when sayor is null", () => {
    const filters: MapFilters = { ...DEFAULT_FILTERS, sayor: null };
    expect(filterProperties(ALL, filters, null)).toHaveLength(4);
  });

  it("filters by partial lot number string match", () => {
    const filters: MapFilters = { ...DEFAULT_FILTERS, lotSearch: "1" };
    // Matches lot 1 and lot 10
    expect(filterProperties(ALL, filters, null)).toEqual([LOT_1, LOT_10]);
  });

  it("returns empty array when lotSearch matches no lots", () => {
    const filters: MapFilters = { ...DEFAULT_FILTERS, lotSearch: "999" };
    expect(filterProperties(ALL, filters, null)).toEqual([]);
  });

  it("applies membership and sayor filters together (intersection)", () => {
    const filters: MapFilters = {
      membership: "Mandatory - Recreation",
      sayor: true,
      lotSearch: "",
    };
    // LOT_2 and LOT_10 are Mandatory - Recreation AND sayor: true
    expect(filterProperties(ALL, filters, null)).toEqual([LOT_2, LOT_10]);
  });
});
