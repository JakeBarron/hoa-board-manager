import { render, screen } from "@testing-library/react";
import { StatusBadge, statusBadgeFor, type AppStatus } from "./StatusBadge";

describe("StatusBadge", () => {
  const cases: { status: AppStatus; label: string }[] = [
    { status: "pending", label: "Pending" },
    { status: "approved", label: "Approved" },
    { status: "denied", label: "Denied" },
    { status: "proposed", label: "Proposed" },
    { status: "in_progress", label: "In Progress" },
    { status: "complete", label: "Complete" },
    { status: "on_hold", label: "On Hold" },
  ];

  it.each(cases)("renders '$label' text for status '$status'", ({ status, label }) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<StatusBadge status="pending" className="test-class" />);
    expect(screen.getByText("Pending")).toHaveClass("test-class");
  });
});

describe("statusBadgeFor", () => {
  it("returns a factory that renders the correct badge", () => {
    const Badge = statusBadgeFor("approved");
    render(<Badge />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });
});
