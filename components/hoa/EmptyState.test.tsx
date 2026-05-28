import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="No projects yet" />);
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(<EmptyState title="No projects" description="Create your first project to get started." />);
    expect(screen.getByText("Create your first project to get started.")).toBeInTheDocument();
  });

  it("omits description when not provided", () => {
    render(<EmptyState title="No projects" />);
    expect(screen.queryByText(/get started/i)).not.toBeInTheDocument();
  });

  it("renders the action slot when provided", () => {
    render(
      <EmptyState title="No requests" action={<button>New Request</button>} />
    );
    expect(screen.getByRole("button", { name: "New Request" })).toBeInTheDocument();
  });

  it("renders the icon slot when provided", () => {
    render(
      <EmptyState title="Nothing here" icon={<span data-testid="icon" />} />
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });
});
