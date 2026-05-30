import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import type { Position } from "@/types/database";

jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
jest.mock("@/actions/auth", () => ({ signOut: jest.fn() }));

const makePosition = (overrides: Partial<Position>): Position => ({
  id: "pos-1",
  name: "president",
  email: "president@yourhoa.com",
  role: "president",
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("Sidebar — board member view", () => {
  it("shows Committee Chairs section for president", () => {
    render(<Sidebar position={makePosition({ role: "president" })} />);
    expect(screen.getByText("Committee Chairs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Architecture Review" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Web Committee" })).toBeInTheDocument();
  });

  it("shows Committee Chairs section for officer", () => {
    render(<Sidebar position={makePosition({ name: "vp", role: "officer" })} />);
    expect(screen.getByText("Committee Chairs")).toBeInTheDocument();
  });

  it("shows Committee Chairs section for member", () => {
    render(<Sidebar position={makePosition({ name: "pool", role: "member" })} />);
    expect(screen.getByText("Committee Chairs")).toBeInTheDocument();
  });

  it("shows Admin section only for president", () => {
    render(<Sidebar position={makePosition({ role: "president" })} />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("hides Admin section for officer", () => {
    render(<Sidebar position={makePosition({ name: "vp", role: "officer" })} />);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });
});

describe("Sidebar — chair view", () => {
  it("shows only Dashboard and own section link", () => {
    render(<Sidebar position={makePosition({ name: "web", role: "chair" })} />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Web Committee" })).toBeInTheDocument();
  });

  it("hides primary nav items from chairs", () => {
    render(<Sidebar position={makePosition({ name: "web", role: "chair" })} />);
    expect(screen.queryByRole("link", { name: "Meetings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Agenda" })).not.toBeInTheDocument();
  });

  it("hides Board Sections from chairs", () => {
    render(<Sidebar position={makePosition({ name: "web", role: "chair" })} />);
    expect(screen.queryByText("Board Sections")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "President" })).not.toBeInTheDocument();
  });

  it("hides Admin section from chairs", () => {
    render(<Sidebar position={makePosition({ name: "web", role: "chair" })} />);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows the correct section link for architecture chair", () => {
    render(<Sidebar position={makePosition({ name: "architecture", role: "chair" })} />);
    expect(screen.getByRole("link", { name: "Architecture Review" })).toHaveAttribute(
      "href",
      "/committee/architecture"
    );
  });
});
