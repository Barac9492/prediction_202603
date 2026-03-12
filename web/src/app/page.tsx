import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <h1 className="mb-4 text-4xl font-bold">SignalTracker</h1>
      <p className="mb-8 text-lg text-zinc-400">
        Extract signals from sources. Track prediction accuracy over time.
      </p>
      <Link
        href="/analyze"
        className="rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
      >
        Start Analysis
      </Link>
    </div>
  );
}
