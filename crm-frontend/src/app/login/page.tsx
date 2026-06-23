export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">Majestan CRM</h1>
        {/* Placeholder Form */}
        <form className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="admin@majestan.com" />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input type="password" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="••••••••" />
          </div>
          <button className="w-full rounded-md bg-primary text-primary-foreground h-10 px-4 py-2 font-medium">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
