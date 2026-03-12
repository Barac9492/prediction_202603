# SignalTracker Phase 1 — CLI MVP Build Plan

## Goal
Working CLI: input source → extract signals → ensemble → predict → save to SQLite

## Tasks

### 1. Project Setup
- [ ] Create Python project structure (src/, pyproject.toml)
- [ ] Set up dependencies (anthropic, beautifulsoup4, newspaper3k, httpx)
- [ ] Create .env.example for API key
- [ ] Create .gitignore

### 2. Data Collection Module
- [ ] URL content extraction (newspaper3k + BeautifulSoup fallback)
- [ ] Plain text input support
- [ ] Source metadata capture (title, date, URL)

### 3. Signal Extraction Module (Claude API)
- [ ] Prompt design for signal extraction (bullish/bearish/neutral + strength 1-5)
- [ ] Structured output parsing (JSON schema)
- [ ] Per-source signal extraction

### 4. Ensemble & Prediction Engine
- [ ] Multi-signal aggregation (weighted average)
- [ ] Contradiction detection between sources
- [ ] Final prediction output: direction + confidence % + top 3 reasons

### 5. Storage Module (SQLite)
- [ ] Schema design (predictions, signals, sources tables)
- [ ] Save prediction with all metadata
- [ ] Query past predictions
- [ ] Record actual outcomes for accuracy tracking

### 6. CLI Interface
- [ ] Main entry point with argparse/click
- [ ] `analyze` command — input sources → get prediction
- [ ] `log` command — view past predictions
- [ ] `resolve` command — record actual outcome
- [ ] `stats` command — view accuracy/calibration

### 7. Verification
- [ ] End-to-end test with real URL
- [ ] Test with multiple sources (contradiction case)
- [ ] Test prediction log save/retrieve cycle
- [ ] Test accuracy tracking flow
