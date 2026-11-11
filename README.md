# AeroCalc — Precision Scientific Calculator & Universal Unit Converter

A modern, responsive, and tactile web calculator engineered with a high-end UI/UX design philosophy, glassmorphism aesthetics, Web Audio synthesizer feedback, scientific computational capabilities, and universal unit conversion.

![AeroCalc Preview](https://raw.githubusercontent.com/feathericons/feather/master/icons/cpu.svg)

---

## 🌟 Key Highlights & Design Philosophy

1. **Aesthetic & Visual Polish**:
   - **Glassmorphism & Depth**: Multi-layered backdrop blurs (`backdrop-filter: blur(24px)`), ambient radial glow effects, and subtle card borders.
   - **Tactile Button Feedback**: Responsive micro-animations with scale transformations, elevation, and distinct color clustering:
     - **Numbers**: Sleek neutral surfaces with high-contrast glyphs.
     - **Operators**: Vibrant gradient accents and glowing states.
     - **Function Keys**: Soft contrast slate for fast mental mapping.
     - **Action & Equals**: High-energy gradient with dynamic drop shadow.
   - **Dynamic Typography Auto-Scaling**: Automatic font reduction (`text-sm`, `text-xs`, `text-xxs`) prevents long digit overflows and awkward wrapping.
   - **Dark & Light Themes**: Auto-detects system color preferences (`prefers-color-scheme`) and provides an instant toggle with persistent storage.

2. **Web Audio Tactile Feedback**:
   - Synthesizes realistic hardware-like soft acoustic clicks using the HTML5 **Web Audio API** (`OscillatorNode` + `GainNode`), with distinct frequencies for numbers, operators, function keys, and calculation results.
   - Includes a one-click mute/unmute toggle that saves preference to `localStorage`.

3. **Scientific Computational Engine**:
   - Seamlessly expandable scientific keypad drawer (`sin`, `cos`, `tan`, `sin⁻¹`, `cos⁻¹`, `tan⁻¹`, `ln`, `log`, `√x`, `∛x`, `xʸ`, `x²`, `1/x`, `n!`, `π`, `e`, `eˣ`, `|x|`).
   - Toggle between **Degrees (DEG)** and **Radians (RAD)** with live trig formula evaluation.
   - Safe expression parsing supporting nested parentheses, operator precedence, and floating-point precision error correction (eliminating `0.1 + 0.2 = 0.30000000000000004`).
   - Division-by-zero protection and graceful error recovery.

4. **Interactive Calculation History Tape**:
   - Slide-in side drawer storing timestamped formulas and answers.
   - Click any past card to reload the result or expression directly into the active calculation.
   - Persisted across browser sessions with `localStorage`.

5. **Universal Unit Converter**:
   - Instant bi-directional conversion with dynamic unit formula details.
   - Supported categories:
     - **Length**: Meters, Kilometers, Centimeters, Millimeters, Miles, Yards, Feet, Inches
     - **Weight & Mass**: Kilograms, Grams, Milligrams, Pounds, Ounces, Metric Tons
     - **Temperature**: Celsius (°C), Fahrenheit (°F), Kelvin (K)
     - **Area**: Square Meters, Square Kilometers, Square Feet, Acres, Hectares
     - **Volume**: Liters, Milliliters, Cubic Meters, Gallons, Quarts, Pints, Cups
     - **Speed**: m/s, km/h, mph, knots
     - **Data Storage**: Bytes, KB, MB, GB, TB
     - **Time**: Seconds, Minutes, Hours, Days, Weeks, Years
   - One-click **"Insert Result into Calculator"** bridge.

6. **Full Keyboard Shortcuts**:
   - Press <kbd>?</kbd> at any time to open the built-in shortcuts cheat sheet.
   - All standard numpad keys, operators, parentheses, backspace, and clear supported.

---

## ⌨️ Keyboard Shortcuts Reference

| Key | Action |
| :--- | :--- |
| `0` – `9` | Input Digits |
| `.` | Input Decimal |
| `+`, `-`, `*`, `/` | Basic Math Operators |
| `Enter` or `=` | Calculate Result |
| `Backspace` | Delete last digit |
| `Escape` or `c` | All Clear (AC) |
| `(` and `)` | Parentheses |
| `%` | Percentage calculation |
| `^` | Exponent / Power ($x^y$) |
| `s` or `r` | Square Root ($\sqrt{x}$) |
| `Alt` + `s` | Toggle Scientific Keypad |
| `h` | Toggle History Drawer |
| `t` | Toggle Dark / Light Theme |
| `m` | Toggle Audio Feedback |
| `?` | Open Keyboard Shortcuts Modal |

---

## 🚀 How to Run

Because AeroCalc is built with pure, modern HTML5, CSS3, and Vanilla JavaScript with zero external build dependencies:

1. Double click [`index.html`](file:///c:/Users/admin/Documents/projects/calculator/index.html) to open directly in any modern browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari).
2. Or serve it via any static local web server:
   ```powershell
   # If Python is installed:
   python -m http.server 3000

   # Or via npx:
   npx serve .
   ```
3. Open `http://localhost:3000` (or file URI) and enjoy!
