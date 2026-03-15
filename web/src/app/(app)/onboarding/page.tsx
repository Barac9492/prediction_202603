"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Conditionally load Clerk components
let useOrganization: () => { organization: unknown } = () => ({
  organization: { id: "dev" },
});
let CreateOrganization: React.ComponentType<{ afterCreateOrganizationUrl?: string; appearance?: unknown }> | null = null;

try {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const clerk = require("@clerk/nextjs");
    useOrganization = clerk.useOrganization;
    CreateOrganization = clerk.CreateOrganization;
  }
} catch {
  // Clerk not available
}

type Step = "create-workspace" | "create-thesis" | "run-pipeline";

const SUGGESTED_THESES = [
  {
    title: "AI infrastructure spend accelerates through 2026",
    description:
      "Major cloud providers and enterprises will increase AI infrastructure spending at >40% CAGR through 2026.",
    direction: "bullish",
    domain: "AI",
  },
  {
    title: "Open-source LLMs reach GPT-4 parity",
    description:
      "Open-source language models will match GPT-4 level capabilities within 12 months.",
    direction: "bullish",
    domain: "AI",
  },
  {
    title: "Enterprise AI adoption hits mainstream",
    description:
      "Majority of Fortune 500 companies will have production AI deployments beyond pilot stage.",
    direction: "bullish",
    domain: "AI",
  },
];

export default function OnboardingPage() {
  const { organization } = useOrganization();
  const router = useRouter();
  const [step, setStep] = useState<Step>(
    organization ? "create-thesis" : "create-workspace"
  );
  const [creating, setCreating] = useState(false);
  const [selectedThesis, setSelectedThesis] = useState(0);

  if (step === "create-workspace" && !organization) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Welcome to SignalTracker</h1>
          <p className="mt-2 text-gray-600">
            Create your workspace to get started.
          </p>
        </div>
        <div className="flex justify-center">
          <CreateOrganization
            afterCreateOrganizationUrl="/"
            appearance={{
              elements: { rootBox: "w-full max-w-md" },
            }}
          />
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (step === "create-workspace" && organization) {
      setStep("create-thesis");
    }
  }, [step, organization]);

  if (step === "create-thesis") {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Create Your First Thesis</h1>
          <p className="mt-2 text-gray-600">
            Pick a thesis to track, or create your own.
          </p>
        </div>

        <div className="space-y-3">
          {SUGGESTED_THESES.map((thesis, i) => (
            <button
              key={i}
              onClick={() => setSelectedThesis(i)}
              className={`w-full rounded-lg border p-4 text-left transition ${
                selectedThesis === i
                  ? "border-blue-500 bg-blue-50"
                  : "hover:border-gray-400"
              }`}
            >
              <p className="font-medium">{thesis.title}</p>
              <p className="mt-1 text-sm text-gray-600">
                {thesis.description}
              </p>
              <span className="mt-2 inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                {thesis.direction}
              </span>
            </button>
          ))}
        </div>

        <button
          disabled={creating}
          onClick={async () => {
            setCreating(true);
            try {
              const thesis = SUGGESTED_THESES[selectedThesis];
              await fetch("/api/theses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(thesis),
              });
              setStep("run-pipeline");
            } catch (e) {
              console.error(e);
            } finally {
              setCreating(false);
            }
          }}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create Thesis"}
        </button>
      </div>
    );
  }

  // Step 3: Run pipeline
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <h1 className="text-2xl font-bold">Run Your First Analysis</h1>
      <p className="mt-2 text-gray-600">
        SignalTracker will scan news sources, extract signals, and compute
        probabilities for your thesis.
      </p>

      <button
        disabled={creating}
        onClick={async () => {
          setCreating(true);
          try {
            await fetch("/api/pipeline/run", { method: "POST" });
            router.push("/");
          } catch (e) {
            console.error(e);
          } finally {
            setCreating(false);
          }
        }}
        className="mt-8 rounded-lg bg-blue-600 px-8 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {creating ? "Running..." : "Run Pipeline"}
      </button>

      <button
        onClick={() => router.push("/")}
        className="mt-4 block w-full text-sm text-gray-500 hover:text-gray-700"
      >
        Skip for now
      </button>
    </div>
  );
}
