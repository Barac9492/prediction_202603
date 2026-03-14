# Polymarket UI/UX Research

Research date: 2026-03-14
Source: Live inspection of polymarket.com via Chrome DevTools

---

## 1. Visual Design Language

### Colors

**Background & Surfaces**
- Page background: `#FFFFFF` (rgb 255, 255, 255)
- Card background: transparent (inherits white)
- Card border: `#E6E8EA` (rgb 230, 232, 234) - 1px solid
- Card shadow: `rgba(0,0,0,0.04) 0px 8px 16px`
- Search bar background: `#F4F5F6` (rgb 244, 245, 246)
- Nav background: `#FFFFFF`

**Text Colors**
- Primary text (headings, strong): `#18181B` (rgb 24, 24, 27)
- Primary text alt: `#0E0F11` (rgb 14, 15, 17)
- Body text: `#000000`
- Secondary/muted text: `#77808D` (rgb 119, 128, 141)
- Volume/meta text: `#AEB4BC` (rgb 174, 180, 188)
- Outcome secondary text: `#31353A` (rgb 49, 53, 58)

**Brand / Accent**
- Primary blue (Trade button, active links, Log In): `#1452F0` (rgb 20, 82, 240)
- Active filter tag text: `#1452F0`

**Yes / No (core to identity)**
- Yes green text: `#30A159` (rgb 48, 161, 89)
- Yes green button bg (filled): `#30A159` (rgb 48, 161, 89)
- Buy Yes light bg (outline variant): `oklab(0.737 -0.147 0.08 / 0.15)` -- approx light green `rgba(48, 161, 89, 0.15)`
- No red text: `#E23939` (rgb 226, 57, 57)
- No red button bg (outline variant): `oklab(0.604 0.185 0.09 / 0.09)` -- approx light red `rgba(226, 57, 57, 0.09)`
- Red change indicator: `#E75D5D` (rgb 231, 93, 93)

**Chart Line Colors**
- Line 1 (red/leader): `#FA534D`
- Line 2 (gold): `#E2BF6C`
- Line 3 (light blue): `#87BFFF`
- Line 4 (dark blue): `#456BD5`

**Sports Card Team Buttons**
- Team button backgrounds use soft tinted colors (light green, light red) similar to Yes/No pattern

### Typography

- **Font family**: `Inter, sans-serif`
- Base font size: `16px`

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Page title (h1) | 24px | 600 | #000000 |
| Section heading (h2) | 24px | 600 | #000000 |
| h1 line-height | 28px | -- | -- |
| Market card title | 16px | 600 | #000000 |
| Outcome name (list) | 16px | 600 | #000000 |
| Probability (large, featured) | 26px | 600 | varies (blue tinted) |
| Probability (card) | 20px | 600 | #18181B |
| Probability (list item) | 28px | 600 | #0E0F11 |
| Probability (small, secondary) | 13px | 600 | #31353A |
| Nav category links | 14px | 600 | #77808D (inactive) / #18181B (active) |
| Filter tags | 14px | 500 | #77808D (inactive) / #1452F0 (active) |
| Volume text | 13px | 490 | #AEB4BC |
| Breadcrumbs | 14px | 540 | #77808D |
| Yes/No label (card) | 13px | 490 | green/red |
| Button text | 14px | 600 | -- |
| Buy/Sell tabs | 16px | 600 | #0E0F11 active / #77808D inactive |
| Amount quick btns | 12px | -- | #0E0F11 |
| Trade button | 16px | 400 | -- |

**Notable**: Uses Inter with non-standard font weights (490, 540) suggesting variable font usage.

### Border Radius

- Cards: `15.2px` (~rounded-2xl in Tailwind, or custom)
- Buttons (Buy Yes/No): `7.2px` (~rounded-lg)
- Search bar: `9.2px` (~rounded-xl)
- Category pills/tags: `9.2px`
- Trade button: `9.2px`
- Amount quick-select buttons: `9.2px`

### Spacing

- Card padding: `12px 0px 0px` (top padding, content has internal padding)
- Category link padding: `4px 10px` (primary), `4px 12px` (secondary)
- Buy Yes/No button padding: `8px 16px`
- Amount button padding: `0px 10px`
- Amount button border: `1px solid #E6E8EA`

### Transitions

All interactive elements use `0.15s cubic-bezier(0.4, 0, 0.2, 1)` for smooth state changes.

---

## 2. Page Layout & Structure

### Homepage Layout

**Header (fixed)**
- Logo (left) + Search bar (center, `#F4F5F6` bg, rounded) + Auth buttons (right)
- Search has `/` keyboard shortcut indicator
- "Log In" is blue text, "Sign Up" is white text on blue bg rounded button

**Primary Navigation (below header)**
- Horizontal scrollable pills: Trending | Breaking | New | (separator) | Politics | Sports | Crypto | Iran | Finance | Geopolitics | Tech | Culture | Economy | Weather & Science | Mentions | Elections | More v
- Active tab: darker text (#18181B), inactive: muted (#77808D)
- All 14px, font-weight 600, padding 4px 10-12px, border-radius 9.2px

**Hero/Featured Section**
- Large card spanning ~65% width, right sidebar ~35%
- Featured card shows: event icon, title, multiple outcome rows with percentages, user comments preview, volume, end date
- Has dot pagination (carousel of featured events)
- Below: horizontal topic shortcuts ("US forces enter Iran", "US x Iran Ceasefire") with < > arrows

**Right Sidebar (homepage)**
- "Breaking news" section: numbered list (1-3), market title + percentage + change indicator (green arrow + %)
- "Hot topics" section: numbered list (1-5), topic name + daily volume + fire emoji + chevron

**"All markets" Grid**
- Section header with search icon, filter icon, bookmark icon
- Horizontal scrollable filter tags: All | Trump | Iran | Oscars | Oil | Midterms | etc.
- Active tag: blue text (#1452F0), inactive: muted (#77808D)
- **4-column grid** of market cards

### Breakpoints
- Mobile: 0-599px
- Tablet: 600-1023px
- Desktop: 1024px+

---

## 3. Market Card Anatomy

### Multi-Outcome Card (e.g., "Oscars 2026: Best Picture Winner")
```
+------------------------------------------+
| [icon]  Market Title                      |
|                                           |
| Outcome A Name          75%    [Yes] [No] |
| Outcome B Name          22%    [Yes] [No] |
|                                           |
| $32M Vol.                    [gift] [bkm] |
+------------------------------------------+
```

- Card border: 1px solid #E6E8EA
- Card border-radius: 15.2px
- Card shadow: subtle (0.04 opacity, 8px 16px blur)
- Icon: small square image (event thumbnail)
- Title: 16px, weight 600, black
- Outcome rows: name (left), percentage (right), Yes/No mini-buttons
- Yes text: green (#30A159), No text: red (#E23939)
- Percentage: 13px weight 600 for secondary outcomes, 20px weight 600 for primary
- Volume: 13px, weight 490, color #AEB4BC
- Footer has gift icon and bookmark icon (right-aligned)

### Binary Yes/No Card (e.g., "US escorts commercial ship through Hormuz")
```
+------------------------------------------+
| [icon]  Market Title            39%       |
|                                 chance    |
|                                           |
|     [  Yes  ]     [  No  ]               |
|                                           |
| $237K Vol.                       [bkm]   |
+------------------------------------------+
```

- Single large percentage displayed prominently
- "chance" label below percentage
- Two large buttons: Yes (green tinted bg) and No (red tinted bg)
- Buttons are wider, more prominent than multi-outcome Yes/No

### Sports/Live Card (e.g., NBA game)
```
+------------------------------------------+
| [team1 logo] 62  Team1          51%      |
| [team2 logo] 59  Team2          50%      |
|                                           |
|     [ Team1 ]     [ Team2 ]              |
|                                           |
| * HT  $6M Vol.  NBA        [gift] [bkm] |
+------------------------------------------+
```

- Red dot + "HT" / "LIVE" / "End P1" / "End P2" indicator
- Score displayed next to team names
- Team-colored action buttons
- Category badge ("NBA", "NHL")

---

## 4. Market Detail Page

### Layout: Two-column (main ~65%, sidebar ~35%)

**Breadcrumb**: `Elections > Global Elections` - 14px, weight 540, muted gray

**Title Section**
- Event icon (48px-ish square)
- Title: 24px, weight 600, black, line-height 28px
- Action icons: embed (</>), share (chain link), bookmark

**Chart Legend**
- Colored dots matching chart lines + candidate name + percentage
- e.g., `* JD Vance 20.4%  * Gavin Newsom 17.1%  * Marco Rubio 15.3%`

**Chart**
- Multi-line chart with colored lines (#FA534D, #E2BF6C, #87BFFF, #456BD5)
- Y-axis: percentage (0%, 10%, 20%, 30%)
- X-axis: date labels (Aug, Sep, Oct, etc.)
- "Polymarket" watermark in chart area (light gray)
- Time period selector: `1H | 6H | 1D | 1W | 1M | ALL` (14px, weight 600, pill style)
- Active period: highlighted, inactive: #77808D
- Chart tools: expand icon, settings gear icon

**Metadata Bar**
- Volume icon + "$398,538,469 Vol."
- Calendar icon + "Nov 7, 2028"
- Rewards icon + "Earn 4%"

**Outcome List**
Each row:
```
[avatar/photo]  Name           20%  ▼7%  [Buy Yes 20.5c] [Buy No 79.6c]
                $8,047,675 Vol. [gift]
```

- Avatar: circular, ~40px
- Name: 16px, weight 600
- Volume below name: smaller, muted
- Percentage: 28px, weight 600, near-black (#0E0F11)
- Change indicator: small colored text (green for up, red for down)
- Buy Yes button: green text (#30A159) on light green bg, rounded (7.2px), 48px height, padding 8px 16px
- Buy No button: red text (#E23939) on light red bg, same dimensions
- "Back to top" button appears when scrolled

### Trading Panel (right sidebar, sticky)

```
+-----------------------------+
|  [avatar]  JD Vance         |
|                              |
|  Buy   Sell      Market v    |
|                              |
|  [===Yes 20.5c===] [No 79.6c]|
|                              |
|  Amount           $0         |
|                              |
|  [+$1] [+$5] [+$10] [+$100] [Max] |
|                              |
|  [========Trade========]     |
|                              |
|  By trading, you agree to... |
+-----------------------------+
```

- Buy/Sell tabs: 16px, weight 600. Active: dark text + underline. Inactive: #77808D
- "Market v" dropdown (order type selector)
- Yes button: solid green bg (#30A159), white text, rounded
- No button: light gray bg, dark text, rounded
- Amount: large display ($0), near-black
- Quick amounts: outlined buttons, 1px solid #E6E8EA, 12px text, rounded 9.2px
- Trade button: solid blue bg (#1452F0), full width, 43px height, 9.2px radius

### Related Markets (below trading panel)
- Category filter tabs: All | Iran | Geopolitics | Politics | Middle...
- Active tab: underlined or highlighted
- List items: icon + title + percentage (18px, weight 600)

### Comments Section (below chart)
- Tabs: `Comments (2,778) | Top Holders | Positions | Activity`
- Comment input: "Add a comment..." with "Post" button (blue bg, rounded)
- Sort: "Newest v" dropdown + "Holders" checkbox
- Each comment: avatar, username, position badge ("164 Yes" in green), timestamp, text, heart icon + count
- "Beware of external links." warning

---

## 5. Distinctive Design Patterns

### 1. **Probability-First Design**
Everything centers on probability percentages. They are the largest, boldest text in every context - 20-28px, weight 600. The number IS the UI.

### 2. **Green/Red Binary System**
- Green (#30A159) = Yes/positive/up
- Red (#E23939) = No/negative/down
- Used consistently across buttons, text, indicators, chart annotations
- Light tinted backgrounds (15% opacity green, 9% opacity red) for button hover/fill states

### 3. **Card-Based Grid Layout**
- 4-column responsive grid
- Uniform card styling: 1px border, 15px radius, subtle shadow
- Cards adapt content based on market type (binary, multi-outcome, sports/live)

### 4. **Minimal Chrome, Maximum Data**
- White background, thin gray borders, very little decoration
- No gradients, no heavy shadows, no color blocks in backgrounds
- Information density is high but feels clean due to whitespace and consistent typography

### 5. **Sticky Trading Panel**
- Right sidebar follows scroll on market detail pages
- Always accessible for quick trading without leaving context

### 6. **Social Proof Integration**
- Comments with position badges (showing what the commenter has bet)
- Volume prominently displayed (signals market legitimacy)
- "Hot topics" with daily volume + fire emoji

### 7. **Horizontal Pill Navigation**
- Categories as horizontally scrollable pills
- Used in both primary nav and filter sections
- Consistent styling: 14px, rounded 9.2px, muted gray inactive, blue or dark active

### 8. **Change Indicators**
- Small up/down arrows with percentage change
- Green for positive movement, red for negative
- Appears on homepage sidebar "Breaking news" and on market detail outcome rows

### 9. **Live Event Treatment**
- Red dot pulsing indicator for live events
- Score display inline with team names
- Period/half-time status labels

### 10. **Inter Variable Font**
- Uses Inter with variable weights (490, 540, 600) for subtle typographic hierarchy
- Creates visual distinction without needing many font sizes

---

## 6. Tailwind CSS Implementation Notes

Polymarket appears to use Tailwind CSS (evidence: `--tw-gradient-from`, `--tw-gradient-via`, `--tw-gradient-to` CSS variables in transitions). Key mappings:

| Polymarket Value | Tailwind Equivalent |
|-----------------|---------------------|
| 15.2px radius | `rounded-2xl` (custom, or `rounded-[15px]`) |
| 9.2px radius | `rounded-xl` (custom, or `rounded-[9px]`) |
| 7.2px radius | `rounded-lg` (custom, or `rounded-[7px]`) |
| #E6E8EA border | `border-gray-200` (close) or custom `border-[#E6E8EA]` |
| #77808D text | `text-gray-500` (close) or custom |
| #18181B text | `text-zinc-900` (exact match) |
| #F4F5F6 bg | `bg-gray-100` (close) or custom |
| 0.15s ease | `transition-all duration-150` |
| Inter font | `font-sans` (with Inter configured) |

### Recommended Tailwind Config Extensions
```
colors: {
  'pm-blue': '#1452F0',
  'pm-green': '#30A159',
  'pm-red': '#E23939',
  'pm-gray': {
    100: '#F4F5F6',
    300: '#E6E8EA',
    400: '#AEB4BC',
    500: '#77808D',
    700: '#31353A',
    900: '#18181B',
  }
}
```
