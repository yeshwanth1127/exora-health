import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import App from "./App";
import { WebsiteRuntimeProvider, decodeWebsite } from "./Runtime";
import type { HospitalTemplateId } from "@hms/website-templates";
const templates: HospitalTemplateId[] = [
  "hospital-pathway",
  "hospital-atlas",
  "hospital-grove",
];
beforeEach(() => {
  history.replaceState({}, "", "/");
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());
function show(template: HospitalTemplateId) {
  return render(
    <WebsiteRuntimeProvider
      previewTemplate={template}
      previewName="Riverbend Hospital"
    >
      <App />
    </WebsiteRuntimeProvider>,
  );
}
it.each(templates)(
  "%s composes all patient sections using the entered hospital identity",
  (template) => {
    show(template);
    expect(
      screen.getAllByRole("link", { name: "Riverbend Hospital home" }),
    ).toHaveLength(2);
    expect(document.querySelector("[data-template]")).toHaveAttribute(
      "data-template",
      template,
    );
    for (const title of [
      "Care for every part of you",
      "The people behind your care",
      "A little time for your health",
      "Before you visit",
    ])
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ask about HDFC ERGO" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /find your way/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Swastikaa Hospital", { exact: true }),
    ).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  },
);
it.each(templates)(
  "%s care navigation closes with Escape and routes to a shared service page",
  (template) => {
    show(template);
    const trigger = screen.getByRole("button", {
      name: "Treatments & services",
    });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.click(
      screen.getByRole("link", { name: "Orthopaedics", exact: true }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Orthopaedics clinic" }),
    ).toBeInTheDocument();
    expect(location.search).toContain("template=" + template);
    expect(document.querySelector("main form")).toBeNull();
  },
);
it.each(templates)(
  "%s keeps the form-free example slot flow with no fake booking",
  (template) => {
    history.replaceState({}, "", "/book?doctor=ananya-rao");
    show(template);
    expect(document.querySelector("main form")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Choose Monday/ }));
    fireEvent.click(screen.getByRole("button", { name: "09:00 AM" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with this slot" }),
    );
    expect(
      screen.getByRole("heading", { name: "Slot selected" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No appointment is reserved or confirmed/),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  },
);
it("Grove consultant search retains the template, name and actual search filter", () => {
  history.replaceState(
    {},
    "",
    "/?template=hospital-grove&name=Riverbend%20Hospital",
  );
  show("hospital-grove");
  fireEvent.change(
    screen.getByRole("textbox", { name: "Find your consultant" }),
    { target: { value: "Ananya" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Find your consultant" }));
  expect(screen.getByText(/1 consultant found/)).toBeInTheDocument();
  expect(location.search).toContain("hospital-grove");
  expect(location.search).toContain("name=Riverbend");
  expect(
    screen.getByRole("link", { name: "View Dr Ananya Rao" }),
  ).toBeInTheDocument();
});
it.each(templates)(
  "%s is accepted by the shared public-profile decoder",
  (template) => {
    const profile = {
      name: "Riverbend Hospital",
      city: "Pune",
      address: "",
      phone: "",
      content: { packages: [] },
      runtime: { template, demoEnabled: false },
    };
    expect(decodeWebsite(profile)).toEqual(profile);
    expect(() =>
      decodeWebsite({
        ...profile,
        runtime: { template: "unknown", demoEnabled: false },
      }),
    ).toThrow();
  },
);
