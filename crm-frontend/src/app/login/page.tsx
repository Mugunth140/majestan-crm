import Image from "next/image";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow">
        <div className="flex flex-col items-center gap-3">
        <Image src={"/logo/logo.png"} alt="Majestan Logo" width={80} height={80} className="filter saturate-0 contrast-200"/>
        <h1 className="text-2xl font-bold mb-6 text-center">Majestan CRM</h1>
        </div>
        {/* Placeholder Form */}
        <form className="space-y-4">
          <div>
            <label className="text-sm font-medium ml-1">Email</label>
            <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 mt-2 text-sm" placeholder="admin@majestan.com" />
          </div>
          <div>
            <label className="text-sm font-medium ml-1">Password</label>
            <input type="password" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 mt-2 text-sm" placeholder="••••••••" />
          </div>
          <button className="w-full rounded-md bg-primary text-primary-foreground h-10 px-4 py-2 font-medium">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
