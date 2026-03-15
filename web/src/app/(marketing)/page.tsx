import Link from "next/link";

const FEATURES = [
  {
    title: "Signal Extraction",
    description:
      "AI-powered analysis of news, filings, and market data to extract bullish/bearish signals automatically.",
  },
  {
    title: "Probability Tracking",
    description:
      "Bayesian log-odds model computes calibrated probabilities for every thesis, updated with each new signal.",
  },
  {
    title: "Recommendation Engine",
    description:
      "Actionable BUY/SELL/HOLD recommendations with conviction scores, time horizons, and provenance chains.",
  },
  {
    title: "Calibration Analytics",
    description:
      "Brier scores, calibration curves, and track record analysis to measure and improve prediction accuracy.",
  },
  {
    title: "Knowledge Graph",
    description:
      "Entities, connections, and signal clusters visualized in an interactive graph with cross-thesis influence.",
  },
  {
    title: "Performance Metrics",
    description:
      "Sharpe ratio, max drawdown, profit factor, hit rates by conviction quintile, and rolling accuracy windows.",
  },
];

const PLANS = [
  {
    name: "Analyst",
    price: "$500",
    period: "/mo",
    seats: "3 seats",
    theses: "25 active theses",
    pipeline: "4 pipeline runs/day",
    cta: "Start Free Trial",
    featured: false,
  },
  {
    name: "Team",
    price: "$2,000",
    period: "/mo",
    seats: "10 seats",
    theses: "100 active theses",
    pipeline: "12 pipeline runs/day",
    cta: "Start Free Trial",
    featured: true,
  },
  {
    name: "Fund",
    price: "$5,000",
    period: "/mo",
    seats: "Unlimited seats",
    theses: "Unlimited theses",
    pipeline: "Unlimited pipeline runs",
    cta: "Contact Sales",
    featured: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="text-xl font-bold">SignalTracker</span>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="text-sm text-gray-600 hover:text-gray-900">
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-24 text-center">
        <h1 className="text-5xl font-bold leading-tight tracking-tight text-gray-900">
          AI Investment Intelligence
          <br />
          with Calibrated Predictions
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          Track investment theses with Bayesian probability models. Extract signals
          from news automatically. Generate recommendations with provenance chains.
          Measure your accuracy with Brier scores.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/sign-up"
            className="rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700"
          >
            Start 14-Day Free Trial
          </Link>
          <Link
            href="#pricing"
            className="rounded-lg border border-gray-300 px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
          >
            View Pricing
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Everything you need for systematic thesis tracking
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-center text-gray-600">
            14-day free trial on all plans. No credit card required.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-lg border p-8 ${
                  plan.featured
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-gray-200"
                }`}
              >
                {plan.featured && (
                  <p className="mb-4 text-xs font-semibold uppercase text-blue-600">
                    Most Popular
                  </p>
                )}
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="mt-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </p>
                <ul className="mt-6 space-y-3 text-sm text-gray-600">
                  <li>{plan.seats}</li>
                  <li>{plan.theses}</li>
                  <li>{plan.pipeline}</li>
                  <li>Bayesian probability engine</li>
                  <li>Knowledge graph</li>
                  <li>Calibration analytics</li>
                </ul>
                <Link
                  href="/sign-up"
                  className={`mt-8 block rounded-lg px-4 py-2.5 text-center text-sm font-medium ${
                    plan.featured
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-gray-500">
          SignalTracker. AI-powered investment intelligence.
        </div>
      </footer>
    </div>
  );
}
