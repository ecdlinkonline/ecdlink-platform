"use client";

import { useState } from "react";
import { Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import type { EcdCentre } from "@/lib/centres/types";

export function CentreEditForm({ centre, mode }: { centre: EcdCentre; mode: "admin" | "centre" }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  return (
    <div className="space-y-6">
      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="dark:text-white">Edit centre profile</CardTitle>
          <CardDescription className="dark:text-slate-400">
            {mode === "admin" ? "Update full centre database fields." : "Update your centre contact details."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-5 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaved(false);
              setError("");
              setIsSaving(true);
              const formData = new FormData(event.currentTarget);
              const payload = Object.fromEntries(formData.entries());
              const response = await fetch(`/api/centres/${centre.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              });
              setIsSaving(false);
              if (!response.ok) {
                setError("We could not save this centre profile. Please check the fields and try again.");
                return;
              }
              setSaved(true);
            }}
          >
            <FormField label="Centre name" name="centreName" defaultValue={centre.centreName} disabled={mode === "centre"} />
            <FormField label="Principal name" name="principalName" defaultValue={centre.principalName} />
            <FormField label="Contact person" name="contactPerson" defaultValue={centre.contactPerson} />
            <FormField label="Phone number" name="phoneNumber" defaultValue={centre.phoneNumber} />
            <FormField label="Email address" name="emailAddress" type="email" defaultValue={centre.emailAddress} />
            <FormField label="Physical address" name="physicalAddress" defaultValue={centre.physicalAddress} />
            {mode === "admin" ? (
              <>
                <FormField label="NPO number" name="npoNumber" defaultValue={centre.npoNumber} />
                <FormField label="DBE registration / partial care status" name="dbeRegistrationStatus" defaultValue={centre.dbeRegistrationStatus} />
                <FormField label="Area" name="area" defaultValue={centre.area} />
                <FormField label="Region" name="region" defaultValue={centre.region} />
                <FormField label="Number of children" name="numberOfChildren" type="number" defaultValue={centre.numberOfChildren} />
                <FormField label="Number of staff" name="numberOfStaff" type="number" defaultValue={centre.numberOfStaff} />
              </>
            ) : null}
            <div className="md:col-span-2">
              <div className="rounded-lg border border-dashed border-brand-line bg-brand-accent p-6 text-center dark:border-slate-800 dark:bg-slate-950">
                <Upload className="mx-auto h-7 w-7 text-brand-navy dark:text-blue-200" />
                <p className="mt-3 font-bold text-brand-ink dark:text-white">Upload centre photos placeholder</p>
                <p className="mt-1 text-sm text-slate-500">Future storage integration will attach photos to this centre profile.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <Button type="submit">
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
              {saved ? <span className="text-sm font-semibold text-brand-green">Profile saved.</span> : null}
              {error ? <span className="text-sm font-semibold text-red-600">{error}</span> : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
