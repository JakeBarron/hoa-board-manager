import { render, screen } from "@testing-library/react";
import { HomesideCard } from "./HomesideCard";

describe("HomesideCard", () => {
  it("renders contact name, tel/mailto links, and the portal link", () => {
    render(
      <HomesideCard
        contactName="Christy Adams"
        phone="555-9000"
        email="christy@homeside.com"
        portalUrl="https://portal.homeside.com"
      />
    );

    expect(screen.getByText("Christy Adams")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "555-9000" })).toHaveAttribute("href", "tel:555-9000");
    expect(screen.getByRole("link", { name: "christy@homeside.com" })).toHaveAttribute(
      "href",
      "mailto:christy@homeside.com"
    );
    expect(screen.getByRole("button", { name: "Open portal" })).toHaveAttribute(
      "href",
      "https://portal.homeside.com"
    );
  });

  it("shows a not-set message when no fields are provided", () => {
    render(<HomesideCard contactName="" phone="" email="" portalUrl="" />);
    expect(screen.getByText(/Not set/)).toBeInTheDocument();
  });
});
