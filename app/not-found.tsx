import Link from "next/link";
import { EmptyState } from "@/components/states/app-states";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-brand-accent px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <EmptyState title="Page not found" description="This ECDLink workspace page does not exist yet." />
        <div className="mt-6 text-center">
          <Link href="/dashboard" className="font-bold text-brand-navy">
            Return to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
