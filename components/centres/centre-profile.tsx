import Link from "next/link";
import { Camera, Edit, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CentreStatusCards } from "@/components/centres/centre-status";
import { CentreActivityTimeline } from "@/components/centres/centre-timeline";
import { CentreModulePlaceholders } from "@/components/centres/centre-placeholders";
import { getMissingProfileFields } from "@/lib/centres/api";
import type { EcdCentre } from "@/lib/centres/types";

export function CentreProfile({
  centre,
  mode
}: {
  centre: EcdCentre;
  mode: "admin" | "centre";
}) {
  const missing = getMissingProfileFields(centre);
  const baseHref = mode === "admin" ? `/dashboard/super-admin/centres/${centre.id}` : "/dashboard/ecd-centre/my-centre";
  const contactItems = [
    { icon: UserRound, label: "Contact person", value: centre.contactPerson },
    { icon: Phone, label: "Phone number", value: centre.phoneNumber },
    { icon: Mail, label: "Email address", value: centre.emailAddress },
    { icon: MapPin, label: "Physical address", value: centre.physicalAddress }
  ];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-brand-navy p-6 text-white sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Badge variant="success" className="bg-white text-brand-green">{centre.registrationStatus}</Badge>
              <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{centre.centreName}</h1>
              <p className="mt-3 max-w-3xl leading-8 text-blue-100">{centre.physicalAddress}</p>
            </div>
            <Link href={`${baseHref}/edit`}>
              <Button variant="secondary">
                <Edit className="h-4 w-4" />
                Edit profile
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      <CentreStatusCards centre={centre} />

      {missing.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="p-5">
            <p className="font-bold text-amber-900 dark:text-amber-100">Missing profile information</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {missing.map((item) => (
                <Badge key={item} variant="warning">{item}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Centre details</CardTitle>
            <CardDescription className="dark:text-slate-400">Core database profile fields for ECDLink.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              ["NPO number", centre.npoNumber],
              ["DBE / partial care", centre.dbeRegistrationStatus],
              ["Area / region", `${centre.area}, ${centre.region}`],
              ["Principal", centre.principalName],
              ["Children", String(centre.numberOfChildren)],
              ["Staff", String(centre.numberOfStaff)],
              ["Created", centre.createdDate],
              ["Last updated", centre.lastUpdatedDate]
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="mt-1 font-bold text-brand-ink dark:text-white">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Contact</CardTitle>
            <CardDescription className="dark:text-slate-400">Primary centre contact information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {contactItems.map((item) => {
              const Icon = item.icon;
              return (
              <div key={item.label} className="flex gap-3 rounded-lg border border-brand-line p-4 dark:border-slate-800">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-brand-navy dark:bg-slate-800 dark:text-blue-200">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-500">{item.label}</p>
                  <p className="mt-1 font-bold text-brand-ink dark:text-white">{item.value}</p>
                </div>
              </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="dark:text-white">Centre photos</CardTitle>
          <CardDescription className="dark:text-slate-400">Photo placeholders for the centre profile gallery.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {centre.centrePhotos.map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-lg border border-brand-line dark:border-slate-800">
              <div className={`grid h-40 place-items-center ${photo.tone}`}>
                <Camera className="h-8 w-8 text-brand-navy" />
              </div>
              <div className="p-4">
                <p className="font-bold text-brand-ink dark:text-white">{photo.title}</p>
                <p className="text-sm text-slate-500">Uploaded {photo.uploadedAt}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {mode === "admin" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Admin notes</CardTitle>
            <CardDescription className="dark:text-slate-400">Internal notes for ECDLink support and operations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {centre.notes.length > 0 ? (
              centre.notes.map((note) => (
                <div key={note.id} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                  <p className="font-bold text-brand-ink dark:text-white">{note.author}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{note.body}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">{note.createdAt}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No notes added yet.</p>
            )}
            <Button>Add note</Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CentreActivityTimeline items={centre.activityTimeline} />
        <CentreModulePlaceholders />
      </div>
    </div>
  );
}
