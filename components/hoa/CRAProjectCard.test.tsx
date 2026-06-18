import { render, screen, fireEvent } from "@testing-library/react";
import { CRAProjectCard } from "./CRAProjectCard";
import type { CRAProject } from "@/types/database";

// Server actions are not available in jsdom — mock to avoid import errors
jest.mock("@/actions/cra", () => ({
  createCRAProject: jest.fn(),
  updateCRAProject: jest.fn(),
  deleteCRAProject: jest.fn(),
  addCRAQuote: jest.fn(),
  updateCRAQuote: jest.fn(),
  deleteCRAQuote: jest.fn(),
  addCRAUpdate: jest.fn(),
  deleteCRAUpdate: jest.fn(),
  uploadCRADocument: jest.fn(),
  deleteCRADocument: jest.fn(),
}));

// next/navigation is unavailable in jsdom
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

const base: CRAProject = {
  id: "p1", name: "Toe Drain", description: null, status: "proposed",
  estimated_cost: 10000000, actual_cost: null, target_date: null,
  fiscal_year_id: null, category: "Lake Maintenance", priority: "high",
  created_by: "u", created_at: "", updated_at: "",
};

describe("CRAProjectCard", () => {
  it("shows name, formatted estimate, category, and quote readiness (collapsed)", () => {
    render(
      <CRAProjectCard
        project={base}
        quotes={[]}
        updates={[]}
        documents={[]}
        fiscalYears={[]}
        canEdit={false}
        positionId="pos"
        expanded={false}
        onToggle={jest.fn()}
      />
    );
    expect(screen.getByText("Toe Drain")).toBeInTheDocument();
    expect(screen.getByText(/\$100,000/)).toBeInTheDocument();
    expect(screen.getByText("Lake Maintenance")).toBeInTheDocument();
    expect(screen.getByText(/0 of 3 quotes/i)).toBeInTheDocument();
  });

  it("calls onToggle when the summary button is clicked", () => {
    const onToggle = jest.fn();
    render(
      <CRAProjectCard
        project={base}
        quotes={[]}
        updates={[]}
        documents={[]}
        fiscalYears={[]}
        canEdit={false}
        positionId="pos"
        expanded={false}
        onToggle={onToggle}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
