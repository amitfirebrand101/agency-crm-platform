import { Building2, Clock, Globe, Palette } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  saveBusinessProfile,
  saveBusinessHours,
} from "@/app/(dashboard)/settings/business-profile/actions";

export const dynamic = "force-dynamic";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export default async function BusinessProfilePage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let profile: {
    businessName: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
    timezone: string | null;
    businessHours: unknown;
    googleReviewUrl: string | null;
    yelpUrl: string | null;
    facebookUrl: string | null;
    website: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
  } | null = null;

  try {
    profile = await prisma.businessProfile.findFirst({
      where: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId ?? undefined,
      },
    });
  } catch (err) {
    console.error("BusinessProfile page fetch failed", err);
    databaseUnavailable = true;
  }

  const hours =
    (profile?.businessHours as Record<
      string,
      { enabled: boolean; start: string; end: string }
    >) ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Business Profile</h1>
        <p className="mt-1 text-sm text-muted">
          Your location&apos;s business info and branding.
        </p>
      </div>

      {databaseUnavailable && <DbWarning />}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* ── Left: business info form ── */}
        <div className="space-y-6">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="text-primary" size={16} />
                <h2 className="font-semibold">Business information</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={saveBusinessProfile} className="space-y-4">
                {user.subAccountId && (
                  <input
                    type="hidden"
                    name="subAccountId"
                    value={user.subAccountId}
                  />
                )}

                <Field
                  label="Business name"
                  name="businessName"
                  placeholder="Acme Agency"
                  defaultValue={profile?.businessName ?? ""}
                />

                <Field
                  label="Website"
                  name="website"
                  type="url"
                  placeholder="https://acmeagency.com"
                  defaultValue={profile?.website ?? ""}
                />

                <Field
                  label="Address"
                  name="address"
                  placeholder="123 Main St"
                  defaultValue={profile?.address ?? ""}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="City"
                    name="city"
                    placeholder="Austin"
                    defaultValue={profile?.city ?? ""}
                  />
                  <Field
                    label="State"
                    name="state"
                    placeholder="TX"
                    defaultValue={profile?.state ?? ""}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="ZIP / Postal code"
                    name="zip"
                    placeholder="78701"
                    defaultValue={profile?.zip ?? ""}
                  />
                  <Field
                    label="Country"
                    name="country"
                    placeholder="US"
                    defaultValue={profile?.country ?? "US"}
                  />
                </div>

                <Field
                  label="Timezone"
                  name="timezone"
                  placeholder="America/New_York"
                  defaultValue={profile?.timezone ?? ""}
                />

                {/* Branding */}
                <div className="border-t border-border pt-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Palette className="text-primary" size={14} />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Branding
                    </span>
                  </div>
                  <div className="space-y-4">
                    <Field
                      label="Logo URL"
                      name="logoUrl"
                      type="url"
                      placeholder="https://cdn.example.com/logo.png"
                      defaultValue={profile?.logoUrl ?? ""}
                    />

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                        Primary color
                      </span>
                      <input
                        type="color"
                        name="primaryColor"
                        defaultValue={profile?.primaryColor ?? "#4361ee"}
                        className="h-9 w-16 cursor-pointer rounded-md border border-border bg-background px-1 py-1"
                      />
                    </label>
                  </div>
                </div>

                {/* Review / social links */}
                <div className="border-t border-border pt-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Globe className="text-primary" size={14} />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Review &amp; social links
                    </span>
                  </div>
                  <div className="space-y-4">
                    <Field
                      label="Google Review URL"
                      name="googleReviewUrl"
                      type="url"
                      placeholder="https://g.page/r/..."
                      defaultValue={profile?.googleReviewUrl ?? ""}
                    />
                    <Field
                      label="Yelp URL"
                      name="yelpUrl"
                      type="url"
                      placeholder="https://www.yelp.com/biz/..."
                      defaultValue={profile?.yelpUrl ?? ""}
                    />
                    <Field
                      label="Facebook URL"
                      name="facebookUrl"
                      type="url"
                      placeholder="https://www.facebook.com/..."
                      defaultValue={profile?.facebookUrl ?? ""}
                    />
                  </div>
                </div>

                <SubmitButton
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"
                  pendingText="Saving…"
                >
                  Save profile
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* ── Right: business hours ── */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="text-primary" size={16} />
                <h2 className="font-semibold">Business hours</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={saveBusinessHours}>
                <div className="space-y-3">
                  {DAYS.map((day) => {
                    const dayHours = hours[day] ?? {
                      enabled:
                        day !== "Saturday" && day !== "Sunday",
                      start: "09:00",
                      end: "17:00",
                    };
                    return (
                      <div
                        key={day}
                        className="flex items-center gap-3"
                      >
                        <input
                          type="checkbox"
                          name={`enabled_${day}`}
                          defaultChecked={dayHours.enabled}
                          className="size-4 accent-primary"
                        />
                        <span className="w-24 text-sm">
                          {day.slice(0, 3)}
                        </span>
                        <input
                          type="time"
                          name={`start_${day}`}
                          defaultValue={dayHours.start}
                          className="rounded border border-border bg-background px-2 py-1 text-sm"
                        />
                        <span className="text-xs text-muted">to</span>
                        <input
                          type="time"
                          name={`end_${day}`}
                          defaultValue={dayHours.end}
                          className="rounded border border-border bg-background px-2 py-1 text-sm"
                        />
                      </div>
                    );
                  })}
                </div>

                <SubmitButton
                  className="mt-4 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"
                  pendingText="Saving…"
                >
                  Save hours
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
