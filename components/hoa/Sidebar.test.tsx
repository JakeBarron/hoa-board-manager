import { render, screen, within } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import type { Position } from "@/types/database";

jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
jest.mock("@/actions/auth", () => ({ signOut: jest.fn() }));

const makePosition = (overrides: Partial<Position>): Position => ({
  id: "pos-1",
  name: "president",
  email: "president@yourhoa.com",
  role: "president",
  is_voting_member: true,
  display_name: null,
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("Sidebar — board member view", () => {
  it("shows My Office link pointing to /board/[name] for a member", () => {
    render(<Sidebar position={makePosition({ name: "pool", role: "member" })} />);
    expect(screen.getByRole("link", { name: "My Office" })).toHaveAttribute("href", "/board/pool");
  });

  it("shows My Office link pointing to /board/president for president", () => {
    render(<Sidebar position={makePosition({ name: "president", role: "president" })} />);
    expect(screen.getByRole("link", { name: "My Office" })).toHaveAttribute("href", "/board/president");
  });

  it("shows all function nav items", () => {
    render(<Sidebar position={makePosition({ role: "president" })} />);
    expect(screen.getByRole("link", { name: "Meetings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Architecture" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CRA Projects" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Amenities" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Properties" })).toBeInTheDocument();
  });

  it("does not show Board Sections group or individual position links", () => {
    render(<Sidebar position={makePosition({ role: "president" })} />);
    expect(screen.queryByText("Board Sections")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Secretary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pool" })).not.toBeInTheDocument();
  });

  it("does not show Committee Chairs group or individual chair links", () => {
    render(<Sidebar position={makePosition({ role: "president" })} />);
    expect(screen.queryByText("Committee Chairs")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Web Committee" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Architecture Review" })).not.toBeInTheDocument();
  });

  it("does not show Pre-Meeting Update link", () => {
    render(<Sidebar position={makePosition({ role: "president" })} />);
    expect(screen.queryByRole("link", { name: "Pre-Meeting Update" })).not.toBeInTheDocument();
  });

  it("shows Admin section only for president", () => {
    render(<Sidebar position={makePosition({ role: "president" })} />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage Positions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("hides Admin section for officer", () => {
    render(<Sidebar position={makePosition({ name: "vp", role: "officer" })} />);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("hides Admin section for member", () => {
    render(<Sidebar position={makePosition({ name: "pool", role: "member" })} />);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });
});

describe("Sidebar — chair view", () => {
  it("shows Dashboard, My Office, Treasury, and Annual Cycle in the primary nav", () => {
    render(<Sidebar position={makePosition({ name: "web", role: "chair" })} />);
    const primaryNav = screen.getByRole("navigation", { name: "Primary navigation" });
    const links = within(primaryNav).getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links[0]).toHaveTextContent("Home");
    expect(links[1]).toHaveTextContent("My Office");
    expect(links[2]).toHaveTextContent("Treasury");
    expect(links[2]).toHaveAttribute("href", "/treasury");
    expect(links[3]).toHaveTextContent("Annual Cycle");
    expect(links[3]).toHaveAttribute("href", "/calendar");
  });

  it("My Office link points to /committee/[name] for chairs", () => {
    render(<Sidebar position={makePosition({ name: "architecture", role: "chair" })} />);
    expect(screen.getByRole("link", { name: "My Office" })).toHaveAttribute(
      "href",
      "/committee/architecture"
    );
  });

  it("hides function nav items from chairs", () => {
    render(<Sidebar position={makePosition({ name: "web", role: "chair" })} />);
    expect(screen.queryByRole("link", { name: "Meetings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Amenities" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Properties" })).not.toBeInTheDocument();
  });

  it("hides Admin section from chairs", () => {
    render(<Sidebar position={makePosition({ name: "web", role: "chair" })} />);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });
});
