import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn()
}));

vi.mock("./sentry", () => ({
  Sentry: {
    addBreadcrumb: mocks.addBreadcrumb
  }
}));

import { trackAnalyticsEvent } from "./analytics";

describe("trackAnalyticsEvent", () => {
  it("records known analytics events as safe allowlisted Sentry breadcrumbs", () => {
    trackAnalyticsEvent("report.viewed", {
      featureId: "report.monthly_preview",
      groupId: "group-1",
      locale: "bn",
      planKey: "khata_pro_group",
      phone: "+880 1700 123456",
      reportType: "monthly_preview",
      surface: "group_report",
      transactionId: "TXN-123"
    } as never);

    expect(mocks.addBreadcrumb).toHaveBeenCalledWith({
      category: "analytics",
      data: {
        featureId: "report.monthly_preview",
        locale: "bn",
        planKey: "khata_pro_group",
        reportType: "monthly_preview",
        surface: "group_report"
      },
      level: "info",
      message: "report.viewed"
    });
  });

  it("drops unsafe analytics payload keys before breadcrumbs can leave the device", () => {
    const event = trackAnalyticsEvent("report.viewed", {
      amountPaisa: 120_000,
      description: "mess bazar",
      displayName: "Rini",
      expenseId: "expense-1",
      groupName: "June Mess",
      memberName: "Tanvir",
      reportRows: [{ amountPaisa: 120_000 }],
      reportType: "monthly_preview",
      userId: "user-1"
    } as never);

    expect(event.payload).toEqual({ reportType: "monthly_preview" });
    expect(mocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reportType: "monthly_preview" } })
    );
  });

  it("throws before tracking unknown analytics events", () => {
    expect(() => trackAnalyticsEvent("report.not_real" as never, {})).toThrow(
      /unknown_analytics_event/
    );
    expect(mocks.addBreadcrumb).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: "report.not_real" })
    );
  });
});
