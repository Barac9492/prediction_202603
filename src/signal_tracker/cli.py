"""CLI interface for SignalTracker."""

from __future__ import annotations

import json
import sys
from typing import Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from signal_tracker import collector, ensemble, extractor, storage

console = Console()


@click.group()
def main():
    """SignalTracker — Structured uncertainty management for VC decisions."""
    pass


@main.command()
@click.argument("topic")
@click.option("--url", "-u", multiple=True, help="URL(s) to analyze")
@click.option("--text", "-t", multiple=True, help="Raw text input(s)")
@click.option("--file", "-f", "files", multiple=True, help="Text file(s) to read")
def analyze(topic: str, url: tuple, text: tuple, files: tuple):
    """Analyze sources and generate a prediction for TOPIC.

    Examples:
        signal-tracker analyze "한국 AI SaaS 투자 타이밍" -u https://example.com/article
        signal-tracker analyze "GPU 공급 부족" -t "NVIDIA reports record demand..."
    """
    if not url and not text and not files:
        console.print("[red]Error: Provide at least one source (--url, --text, or --file)[/red]")
        sys.exit(1)

    # 1. Collect sources
    sources: list[collector.Source] = []
    for u in url:
        console.print(f"[dim]Fetching {u}...[/dim]")
        try:
            sources.append(collector.from_url(u))
            console.print(f"  [green]✓[/green] {sources[-1].title or u}")
        except Exception as e:
            console.print(f"  [red]✗ Failed: {e}[/red]")

    for t in text:
        sources.append(collector.from_text(t))
        console.print(f"  [green]✓[/green] Manual text input ({len(t)} chars)")

    for f in files:
        try:
            content = open(f).read()
            sources.append(collector.from_text(content, title=f))
            console.print(f"  [green]✓[/green] File: {f}")
        except Exception as e:
            console.print(f"  [red]✗ Failed to read {f}: {e}[/red]")

    if not sources:
        console.print("[red]No valid sources collected. Aborting.[/red]")
        sys.exit(1)

    # 2. Extract signals from each source
    all_signals: list[extractor.Signal] = []
    source_meta: list[tuple] = []

    for src in sources:
        console.print(f"\n[dim]Extracting signals from: {src.title or 'source'}...[/dim]")
        try:
            result = extractor.extract_signals(src, topic)
            all_signals.extend(result.signals)
            source_meta.append((
                src.title, src.url, result.source_summary,
                result.relevance_score, src.collected_at,
            ))
            console.print(f"  [green]✓[/green] {len(result.signals)} signals extracted (relevance: {result.relevance_score}/5)")
        except Exception as e:
            console.print(f"  [red]✗ Extraction failed: {e}[/red]")

    if not all_signals:
        console.print("[red]No signals extracted. Aborting.[/red]")
        sys.exit(1)

    # 3. Ensemble
    prediction = ensemble.ensemble(all_signals)

    # 4. Display results
    _display_prediction(topic, prediction, all_signals)

    # 5. Save to DB
    db = storage.get_db()
    pred_id = storage.save_prediction(db, topic, prediction, all_signals, source_meta)
    db.close()
    console.print(f"\n[dim]Saved as prediction #{pred_id}[/dim]")


def _display_prediction(topic: str, pred: ensemble.Prediction, signals: list[extractor.Signal]):
    """Render prediction results in the terminal."""
    # Direction color
    color = {"bullish": "green", "bearish": "red", "neutral": "yellow"}[pred.direction]

    # Header panel
    console.print()
    console.print(Panel(
        f"[bold]{topic}[/bold]\n\n"
        f"[{color} bold]{pred.direction.upper()}[/{color} bold]  "
        f"Confidence: [bold]{pred.confidence}%[/bold]  "
        f"(Score: {pred.weighted_score:+.1f})",
        title="📊 Prediction",
        border_style=color,
    ))

    # Top reasons
    console.print("\n[bold]Top Reasons:[/bold]")
    for i, reason in enumerate(pred.top_reasons, 1):
        console.print(f"  {i}. {reason}")

    # Signal breakdown table
    table = Table(title="\nSignal Breakdown", show_lines=True)
    table.add_column("#", width=3)
    table.add_column("Direction", width=10)
    table.add_column("Str", width=3)
    table.add_column("Signal", min_width=30)
    table.add_column("Source", width=20)

    for i, s in enumerate(sorted(signals, key=lambda x: x.strength, reverse=True), 1):
        dir_color = {"bullish": "green", "bearish": "red", "neutral": "yellow"}[s.direction]
        table.add_row(
            str(i),
            f"[{dir_color}]{s.direction}[/{dir_color}]",
            str(s.strength),
            s.description,
            s.source_title[:20] if s.source_title else "-",
        )

    console.print(table)

    # Contradictions
    if pred.contradictions:
        console.print(f"\n[yellow bold]⚠ {len(pred.contradictions)} Contradiction(s) Detected:[/yellow bold]")
        for c in pred.contradictions:
            console.print(f"  • {c.description}")

    # Summary stats
    console.print(f"\n[dim]Signals: {pred.signal_count} total "
                  f"({pred.bullish_count} bullish, {pred.bearish_count} bearish, {pred.neutral_count} neutral)[/dim]")


@main.command()
@click.option("--limit", "-n", default=20, help="Number of predictions to show")
@click.option("--detail", "-d", type=int, help="Show details for prediction ID")
def log(limit: int, detail: Optional[int]):
    """View past predictions."""
    db = storage.get_db()

    if detail is not None:
        data = storage.get_prediction_detail(db, detail)
        if not data:
            console.print(f"[red]Prediction #{detail} not found.[/red]")
            return
        p = data["prediction"]
        color = {"bullish": "green", "bearish": "red", "neutral": "yellow"}.get(p["direction"], "white")
        console.print(Panel(
            f"[bold]{p['topic']}[/bold]\n"
            f"[{color}]{p['direction'].upper()}[/{color}] {p['confidence']}% | Score: {p['weighted_score']:+.1f}\n"
            f"Created: {p['created_at'][:16]}\n"
            f"Outcome: {p.get('actual_outcome') or 'Pending'}",
            title=f"Prediction #{detail}",
        ))
        console.print("\n[bold]Signals:[/bold]")
        for s in data["signals"]:
            dir_color = {"bullish": "green", "bearish": "red", "neutral": "yellow"}.get(s["direction"], "white")
            console.print(f"  [{dir_color}]{s['direction']}[/{dir_color}] ({s['strength']}/5) {s['description']}")
        console.print("\n[bold]Sources:[/bold]")
        for s in data["sources"]:
            console.print(f"  • {s['title']} {s['url'] or ''}")
        db.close()
        return

    predictions = storage.list_predictions(db, limit)
    db.close()

    if not predictions:
        console.print("[dim]No predictions yet. Run 'analyze' first.[/dim]")
        return

    table = Table(title="Prediction Log")
    table.add_column("ID", width=4)
    table.add_column("Date", width=12)
    table.add_column("Topic", min_width=30)
    table.add_column("Direction", width=10)
    table.add_column("Conf%", width=6)
    table.add_column("Outcome", width=10)

    for p in predictions:
        dir_color = {"bullish": "green", "bearish": "red", "neutral": "yellow"}.get(p["direction"], "white")
        outcome = p["actual_outcome"] or "[dim]—[/dim]"
        table.add_row(
            str(p["id"]),
            p["created_at"][:10],
            p["topic"][:40],
            f"[{dir_color}]{p['direction']}[/{dir_color}]",
            f"{p['confidence']}",
            outcome,
        )

    console.print(table)


@main.command()
@click.argument("prediction_id", type=int)
@click.argument("outcome", type=click.Choice(["bullish", "bearish", "neutral"]))
@click.option("--notes", "-n", default="", help="Notes about the outcome")
def resolve(prediction_id: int, outcome: str, notes: str):
    """Record actual outcome for a prediction.

    Example: signal-tracker resolve 1 bullish --notes "AI fund raised successfully"
    """
    db = storage.get_db()
    pred = db.execute("SELECT * FROM predictions WHERE id = ?", (prediction_id,)).fetchone()
    if not pred:
        console.print(f"[red]Prediction #{prediction_id} not found.[/red]")
        db.close()
        return

    storage.resolve_prediction(db, prediction_id, outcome, notes)
    db.close()

    was_correct = pred["direction"] == outcome
    result_color = "green" if was_correct else "red"
    console.print(f"Prediction #{prediction_id}: predicted [bold]{pred['direction']}[/bold], "
                  f"actual [{result_color}]{outcome}[/{result_color}] — "
                  f"[{result_color}]{'CORRECT' if was_correct else 'INCORRECT'}[/{result_color}]")


@main.command()
def stats():
    """View prediction accuracy and calibration stats."""
    db = storage.get_db()
    cal = storage.get_calibration_stats(db)
    db.close()

    if cal["total"] == 0:
        console.print("[dim]No resolved predictions yet. Use 'resolve' to record outcomes.[/dim]")
        return

    console.print(Panel(
        f"Total resolved: [bold]{cal['total']}[/bold]\n"
        f"Correct: [green]{cal['correct']}[/green]\n"
        f"Accuracy: [bold]{cal['accuracy']}%[/bold]",
        title="📈 Calibration Stats",
    ))

    table = Table(title="Accuracy by Confidence Bucket")
    table.add_column("Confidence", width=12)
    table.add_column("Correct", width=8)
    table.add_column("Total", width=8)
    table.add_column("Accuracy", width=10)

    for bucket, data in cal["by_confidence"].items():
        if data["total"] > 0:
            table.add_row(
                bucket + "%",
                str(data["correct"]),
                str(data["total"]),
                f"{data['accuracy']:.1f}%",
            )

    console.print(table)


if __name__ == "__main__":
    main()
