import { render, screen } from "@testing-library/react";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders the title", () => {
    render(<PageHeader title="Architecture Approvals" />);
    expect(screen.getByRole("heading", { level: 1, name: "Architecture Approvals" })).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<PageHeader title="CRA Projects" subtitle="Capital Reserves Analysis" />);
    expect(screen.getByText("Capital Reserves Analysis")).toBeInTheDocument();
  });

  it("omits subtitle element when not provided", () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("renders the action slot when provided", () => {
    render(<PageHeader title="Projects" action={<button>New Project</button>} />);
    expect(screen.getByRole("button", { name: "New Project" })).toBeInTheDocument();
  });

  it("omits the action slot when not provided", () => {
    render(<PageHeader title="Projects" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
