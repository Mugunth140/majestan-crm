import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { headerPrimaryClass } from "@/components/layout/list-page";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background">
      <EmptyState
        kind="notFound"
        title="This page doesn't exist"
        description="The link may be old, or the page was moved."
        action={
          <Link href="/" className={headerPrimaryClass}>
            Back to dashboard
          </Link>
        }
      />
    </main>
  );
}
