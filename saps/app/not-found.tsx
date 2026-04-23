import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-bold text-muted-foreground/30">404</p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Even genies lose track sometimes. That page doesn&rsquo;t exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-10 min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Back to home
      </Link>
    </div>
  );
}
