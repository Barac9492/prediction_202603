export default function SignInPage() {
  const hasClerk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_");

  if (!hasClerk) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign In</h1>
          <p className="mt-2 text-gray-500">Clerk not configured. Running in dev mode.</p>
          <a href="/dashboard" className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Dynamic import to avoid errors when Clerk isn't configured
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SignIn } = require("@clerk/nextjs");
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
