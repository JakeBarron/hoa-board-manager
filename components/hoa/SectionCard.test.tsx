import { render, screen } from "@testing-library/react";
import { SectionCard } from "./SectionCard";

describe("SectionCard", () => {
  it("renders the title and children", () => {
    render(<SectionCard title="Quotes"><p>Quote content</p></SectionCard>);
    expect(screen.getByText("Quotes")).toBeInTheDocument();
    expect(screen.getByText("Quote content")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(
      <SectionCard title="Projects" description="Active capital projects">
        <span>body</span>
      </SectionCard>
    );
    expect(screen.getByText("Active capital projects")).toBeInTheDocument();
  });

  it("omits description when not provided", () => {
    render(<SectionCard title="Projects"><span>body</span></SectionCard>);
    expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
  });

  it("renders the headerAction slot when provided", () => {
    render(
      <SectionCard title="Todos" headerAction={<button>Add</button>}>
        <span>body</span>
      </SectionCard>
    );
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });
});
