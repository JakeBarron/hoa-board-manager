import { render, screen } from "@testing-library/react";
import { CRAProjectCard } from "./CRAProjectCard";
import type { CRAProject } from "@/types/database";

const base: CRAProject = {
  id: "p1", name: "Toe Drain", description: null, status: "proposed",
  estimated_cost: 10000000, actual_cost: null, target_date: null,
  fiscal_year_id: null, category: "Lake Maintenance", priority: "high",
  created_by: "u", created_at: "", updated_at: "",
};

describe("CRAProjectCard", () => {
  it("shows name, formatted estimate, category, and quote readiness", () => {
    render(<CRAProjectCard project={base} quoteCount={2} />);
    expect(screen.getByText("Toe Drain")).toBeInTheDocument();
    expect(screen.getByText("$100,000")).toBeInTheDocument();
    expect(screen.getByText("Lake Maintenance")).toBeInTheDocument();
    expect(screen.getByText(/2 of 3 quotes/i)).toBeInTheDocument();
  });

  it("links to the project detail page", () => {
    render(<CRAProjectCard project={base} quoteCount={0} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/cra/p1");
  });
});
