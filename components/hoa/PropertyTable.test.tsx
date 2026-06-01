import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropertyTable } from "./PropertyTable";
import type { Property } from "@/types/database";

const make = (overrides: Partial<Property>): Property => ({
  id: "id-1",
  lot_number: 1,
  first_name: "Jane",
  last_name: "Doe",
  account_number: "140001",
  street_address: "123 Main St",
  membership: "Mandatory",
  membership_type: "Mandatory - Recreation",
  annual_lease_fee: null,
  has_annual_lease_fee: false,
  email_1: "jane@example.com",
  email_2: null,
  key_fob_1: "30001",
  key_fob_2: "30002",
  sayor: false,
  ...overrides,
});

const LOT_5 = make({ id: "id-5", lot_number: 5, last_name: "Smith" });
const LOT_12 = make({ id: "id-12", lot_number: 12, last_name: "Garcia" });

describe("PropertyTable", () => {
  it("renders a row for each lot passed in", () => {
    render(<PropertyTable lots={[LOT_5, LOT_12]} onLotClick={() => {}} />);
    expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12" })).toBeInTheDocument();
  });

  it("calls onLotClick with the correct lot_number when lot # button is clicked", async () => {
    const user = userEvent.setup();
    const onLotClick = jest.fn();
    render(<PropertyTable lots={[LOT_5, LOT_12]} onLotClick={onLotClick} />);
    await user.click(screen.getByRole("button", { name: "5" }));
    expect(onLotClick).toHaveBeenCalledWith(5);
    expect(onLotClick).toHaveBeenCalledTimes(1);
  });

  it("renders null fields as an em dash", () => {
    const lot = make({ email_1: null, key_fob_1: null, annual_lease_fee: null });
    render(<PropertyTable lots={[lot]} onLotClick={() => {}} />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("renders SAYOR as 'Yes' or 'No'", () => {
    const sayorLot = make({ sayor: true });
    const nonSayorLot = make({ lot_number: 2, sayor: false });
    render(<PropertyTable lots={[sayorLot, nonSayorLot]} onLotClick={() => {}} />);
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("shows 'Yes' in Annual Lease Fee when has_annual_lease_fee is true and no dollar amount", () => {
    const lot = make({ has_annual_lease_fee: true, annual_lease_fee: null });
    render(<PropertyTable lots={[lot]} onLotClick={() => {}} />);
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("renders an empty table body when no lots are provided", () => {
    render(<PropertyTable lots={[]} onLotClick={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
