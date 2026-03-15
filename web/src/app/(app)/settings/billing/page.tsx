"use client";

import { useOrganization } from "@clerk/nextjs";
import { useEffect, useState } from "react";

type WorkspacePlan = {
  plan: string;
  seatLimit: number;
  thesisLimit: number;
  pipelineRunsPerDay: number;
  currentTheses: number;
  currentSeats: number;
};

const PLANS = [
  {
    id: "analyst",
    name: "Analyst",
    price: "$500/mo",
    seats: 3,
    theses: 25,
    pipeline: 4,
  },
  {
    id: "team",
    name: "Team",
    price: "$2,000/mo",
    seats: 10,
    theses: 100,
    pipeline: 12,
  },
  {
    id: "fund",
    name: "Fund",
    price: "$5,000/mo",
    seats: "Unlimited",
    theses: "Unlimited",
    pipeline: "Unlimited",
  },
];

export default function BillingPage() {
  const { organization } = useOrganization();
  const [plan, setPlan] = useState<WorkspacePlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization) return;
    fetch("/api/billing/current")
      .then((r) => r.json())
      .then(setPlan)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [organization]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing & Plan</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription and usage.
        </p>
      </div>

      {/* Current plan */}
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Current Plan</h2>
        <p className="mt-1 text-2xl font-bold capitalize">
          {plan?.plan ?? "trial"}
        </p>

        {plan && (
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Seats</p>
              <p className="font-medium">
                {plan.currentSeats} / {plan.seatLimit}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Active Theses</p>
              <p className="font-medium">
                {plan.currentTheses} / {plan.thesisLimit}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Pipeline Runs/Day</p>
              <p className="font-medium">{plan.pipelineRunsPerDay}</p>
            </div>
          </div>
        )}
      </div>

      {/* Plan options */}
      <div>
        <h2 className="text-lg font-semibold">Plans</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={`rounded-lg border p-6 ${
                plan?.plan === p.id
                  ? "border-blue-500 ring-2 ring-blue-200"
                  : ""
              }`}
            >
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-2xl font-bold">{p.price}</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>{p.seats} seats</li>
                <li>{p.theses} active theses</li>
                <li>{p.pipeline} pipeline runs/day</li>
              </ul>
              {plan?.plan !== p.id && (
                <button
                  className="mt-4 w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  onClick={() => {
                    // Open Paddle checkout
                    window.open(
                      `/api/billing/checkout?plan=${p.id}`,
                      "_blank"
                    );
                  }}
                >
                  {plan?.plan === "trial" || plan?.plan === "expired"
                    ? "Subscribe"
                    : "Switch Plan"}
                </button>
              )}
              {plan?.plan === p.id && (
                <p className="mt-4 text-center text-sm font-medium text-blue-600">
                  Current Plan
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
