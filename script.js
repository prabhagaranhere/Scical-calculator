/**
 * AeroCalc — Modern Scientific Calculator & Unit Converter
 * Pure vanilla JavaScript with Web Audio feedback, robust math parser,
 * responsive design & localStorage persistence.
 */

(function () {
  'use strict';

  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  const state = {
    currentInput: '0',
    expression: '',
    previousAnswer: null,
    isEvaluated: false,
    memory: 0,
    angleMode: 'DEG', // 'DEG' | 'RAD'
    isScientificExpanded: false,
    isSoundEnabled: true,
    history: [],
    theme: 'dark',
    activeMode: 'calc', // 'calc' | 'converter'
    activeCategory: 'length'
  };

  // =========================================================================
  // DOM ELEMENTS CACHE
  // =========================================================================
  const el = {
    body: document.body,
    appContainer: document.querySelector('.app-container'),
    primaryDisplay: document.getElementById('primaryDisplay'),
    expressionDisplay: document.getElementById('expressionDisplay'),
    statusIndicator: document.getElementById('statusIndicator'),
    displayContainer: document.getElementById('displayContainer'),
    copyBtn: document.getElementById('copyBtn'),
    copyTooltip: document.getElementById('copyTooltip'),
    toastNotice: document.getElementById('toastNotice'),
    toastText: document.getElementById('toastText'),

    // Toggles & Modes
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    angleModeBtn: document.getElementById('angleModeBtn'),
    sciToggleBtn: document.getElementById('sciToggleBtn'),
    scientificKeypad: document.getElementById('scientificKeypad'),
    memoryIndicator: document.getElementById('memoryIndicator'),

    // History
    historyToggleBtn: document.getElementById('historyToggleBtn'),
    historyDrawer: document.getElementById('historyDrawer'),
    closeHistoryBtn: document.getElementById('closeHistoryBtn'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    historyList: document.getElementById('historyList'),
    historyBadge: document.getElementById('historyBadge'),

    // Views
    modeCalcBtn: document.getElementById('modeCalcBtn'),
    modeConverterBtn: document.getElementById('modeConverterBtn'),
    calcSection: document.getElementById('calcSection'),
    converterSection: document.getElementById('converterSection'),

    // Converter
    converterCategories: document.getElementById('converterCategories'),
    convFromValue: document.getElementById('convFromValue'),
    convFromUnit: document.getElementById('convFromUnit'),
    convToValue: document.getElementById('convToValue'),
    convToUnit: document.getElementById('convToUnit'),
    convSwapBtn: document.getElementById('convSwapBtn'),
    convFormulaText: document.getElementById('convFormulaText'),
    convSendToCalcBtn: document.getElementById('convSendToCalcBtn'),

    // Shortcuts Modal
    helpModalBtn: document.getElementById('helpModalBtn'),
    shortcutsModal: document.getElementById('shortcutsModal'),
    closeModalBtn: document.getElementById('closeModalBtn')
  };

  // =========================================================================
  // WEB AUDIO HAPTIC / CLICK FEEDBACK
  // =========================================================================
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(type = 'num') {
    if (!state.isSoundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      let freq = 340;
      let duration = 0.025;
      let wave = 'sine';

      switch (type) {
        case 'num':
          freq = 360;
          wave = 'sine';
          duration = 0.025;
          break;
        case 'op':
          freq = 480;
          wave = 'triangle';
          duration = 0.035;
          break;
        case 'func':
          freq = 280;
          wave = 'sine';
          duration = 0.03;
          break;
        case 'equals':
          freq = 640;
          wave = 'sine';
          duration = 0.06;
          break;
        case 'error':
          freq = 180;
          wave = 'sawtooth';
          duration = 0.08;
          break;
      }

      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // AudioContext policy suppression gracefully ignored
    }
  }

  // =========================================================================
  // TOAST NOTIFICATIONS
  // =========================================================================
  let toastTimer = null;
  function showToast(message) {
    if (!el.toastNotice) return;
    el.toastText.textContent = message;
    el.toastNotice.classList.remove('hide');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toastNotice.classList.add('hide');
    }, 2400);
  }

  // =========================================================================
  // DISPLAY & FORMATTING
  // =========================================================================
  function formatNumber(numStr) {
    if (numStr === 'Error' || numStr === 'Cannot divide by 0' || numStr === 'Infinity' || numStr === '-Infinity' || isNaN(Number(numStr))) {
      return numStr;
    }

    // Split decimal
    const parts = numStr.split('.');
    let intPart = parts[0];
    const decPart = parts.length > 1 ? '.' + parts[1] : '';

    // Add thousands separators if not too long / exponential
    if (!intPart.includes('e') && !intPart.includes('E')) {
      intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    return intPart + decPart;
  }

  function updateDisplay() {
    const rawVal = state.currentInput;
    const formatted = formatNumber(rawVal);
    el.primaryDisplay.textContent = formatted;
    el.expressionDisplay.textContent = state.expression;

    // Dynamic Font Scaling
    const len = formatted.length;
    el.primaryDisplay.classList.remove('text-sm', 'text-xs', 'text-xxs');
    if (len > 18) {
      el.primaryDisplay.classList.add('text-xxs');
    } else if (len > 13) {
      el.primaryDisplay.classList.add('text-xs');
    } else if (len > 9) {
      el.primaryDisplay.classList.add('text-sm');
    }

    // Scroll to right
    el.primaryDisplay.scrollLeft = el.primaryDisplay.scrollWidth;
    el.expressionDisplay.scrollLeft = el.expressionDisplay.scrollWidth;
  }

  // =========================================================================
  // MATH & EVALUATION ENGINE
  // =========================================================================
  function roundPrecision(val, maxDecimals = 10) {
    if (!isFinite(val)) return val;
    // Fix IEEE 754 float precision (e.g., 0.1 + 0.2)
    const factor = Math.pow(10, maxDecimals);
    const rounded = Math.round((val + Number.EPSILON) * factor) / factor;
    return parseFloat(rounded.toFixed(maxDecimals));
  }

  function factorial(n) {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    if (!Number.isInteger(n) || n > 170) return Infinity; // Prevent overflow
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  function evaluateExpression(expr) {
    // Sanitize and replace math visual operators with JavaScript math functions
    let safeExpr = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/\^/g, '**');

    // Handle constants
    safeExpr = safeExpr.replace(/π/g, `${Math.PI}`);
    safeExpr = safeExpr.replace(/\be\b/g, `${Math.E}`);

    // Parse trig with respect to angleMode (DEG / RAD)
    const isDeg = state.angleMode === 'DEG';
    const toRad = isDeg ? ` * (Math.PI / 180)` : '';
    const fromRad = isDeg ? ` * (180 / Math.PI)` : '';

    // Replace function tokens
    safeExpr = safeExpr.replace(/sin\(/g, `Math.sin(`);
    safeExpr = safeExpr.replace(/cos\(/g, `Math.cos(`);
    safeExpr = safeExpr.replace(/tan\(/g, `Math.tan(`);
    safeExpr = safeExpr.replace(/asin\(/g, `Math.asin(`);
    safeExpr = safeExpr.replace(/acos\(/g, `Math.acos(`);
    safeExpr = safeExpr.replace(/atan\(/g, `Math.atan(`);
    safeExpr = safeExpr.replace(/ln\(/g, `Math.log(`);
    safeExpr = safeExpr.replace(/log\(/g, `Math.log10(`);
    safeExpr = safeExpr.replace(/sqrt\(/g, `Math.sqrt(`);
    safeExpr = safeExpr.replace(/cbrt\(/g, `Math.cbrt(`);
    safeExpr = safeExpr.replace(/abs\(/g, `Math.abs(`);
    safeExpr = safeExpr.replace(/exp\(/g, `Math.exp(`);

    // If DEG mode, wrap trig calls
    if (isDeg) {
      safeExpr = safeExpr.replace(/Math\.sin\(([^)]+)\)/g, `Math.sin(($1)${toRad})`);
      safeExpr = safeExpr.replace(/Math\.cos\(([^)]+)\)/g, `Math.cos(($1)${toRad})`);
      safeExpr = safeExpr.replace(/Math\.tan\(([^)]+)\)/g, `Math.tan(($1)${toRad})`);
      safeExpr = safeExpr.replace(/Math\.asin\(([^)]+)\)/g, `(Math.asin($1)${fromRad})`);
      safeExpr = safeExpr.replace(/Math\.acos\(([^)]+)\)/g, `(Math.acos($1)${fromRad})`);
      safeExpr = safeExpr.replace(/Math\.atan\(([^)]+)\)/g, `(Math.atan($1)${fromRad})`);
    }

    // Auto close missing parentheses
    let openParens = (safeExpr.match(/\(/g) || []).length;
    let closeParens = (safeExpr.match(/\)/g) || []).length;
    while (openParens > closeParens) {
      safeExpr += ')';
      closeParens++;
    }

    // Safety verification: only allow numbers, math operators, parens, and standard Math identifier characters
    const validCharactersRegex = /^[\d\s+\-*\/%.(),a-zA-Z\^]+$/;
    if (!validCharactersRegex.test(safeExpr)) {
      throw new Error('Invalid Expression Syntax');
    }

    // Safely evaluate using Function constructor with no global scope leakage
    // Check division by zero
    const result = new Function(`return (${safeExpr});`)();

    if (result === Infinity || result === -Infinity) {
      // Check if caused by division by zero
      if (expr.includes('÷ 0') || expr.includes('/ 0')) {
        return 'Cannot divide by 0';
      }
      return 'Infinity';
    }

    if (isNaN(result)) {
      return 'Error';
    }

    return roundPrecision(result);
  }

  // =========================================================================
  // INPUT ACTIONS
  // =========================================================================
  function inputDigit(digit) {
    playTone('num');
    el.statusIndicator.textContent = 'Calculating';

    if (state.isEvaluated) {
      state.currentInput = digit;
      state.expression = '';
      state.isEvaluated = false;
    } else {
      if (state.currentInput === '0' || state.currentInput === 'Error' || state.currentInput === 'Cannot divide by 0') {
        state.currentInput = digit;
      } else {
        if (state.currentInput.length < 24) {
          state.currentInput += digit;
        }
      }
    }
    updateDisplay();
  }

  function inputDecimal() {
    playTone('num');
    if (state.isEvaluated) {
      state.currentInput = '0.';
      state.expression = '';
      state.isEvaluated = false;
    } else if (!state.currentInput.includes('.')) {
      state.currentInput += '.';
    }
    updateDisplay();
  }

  function inputOperator(opSymbol) {
    playTone('op');
    el.statusIndicator.textContent = 'Computing';

    if (state.currentInput === 'Error' || state.currentInput === 'Cannot divide by 0') {
      clearAll();
      return;
    }

    if (state.isEvaluated) {
      state.expression = `${state.currentInput} ${opSymbol} `;
      state.currentInput = '0';
      state.isEvaluated = false;
    } else {
      const trimmedExpr = state.expression.trim();
      const lastChar = trimmedExpr.slice(-1);
      const isLastOperator = ['+', '−', '×', '÷', '^'].includes(lastChar);

      if (trimmedExpr.endsWith(')') && state.currentInput === '0') {
        state.expression = `${trimmedExpr} ${opSymbol} `;
      } else if (state.currentInput === '0' && isLastOperator) {
        state.expression = trimmedExpr.slice(0, -1) + `${opSymbol} `;
      } else {
        state.expression += `${state.currentInput} ${opSymbol} `;
        state.currentInput = '0';
      }
    }
    updateDisplay();
  }

  function calculateResult() {
    if (state.isEvaluated) {
      playTone('equals');
      return;
    }

    let fullExpr = state.expression;
    const trimmed = state.expression.trim();
    if (trimmed.endsWith(')') && state.currentInput === '0') {
      fullExpr = trimmed;
    } else {
      fullExpr = (state.expression + state.currentInput).trim();
    }

    if (!fullExpr) return;

    try {
      const result = evaluateExpression(fullExpr);
      if (result === 'Cannot divide by 0' || result === 'Error') {
        playTone('error');
        state.currentInput = result;
        state.isEvaluated = true;
        el.statusIndicator.textContent = 'Math Error';
      } else {
        playTone('equals');
        const formattedRes = String(result);
        addHistoryItem(fullExpr, formattedRes);
        state.previousAnswer = formattedRes;
        state.expression = `${fullExpr} =`;
        state.currentInput = formattedRes;
        state.isEvaluated = true;
        el.statusIndicator.textContent = 'Calculated';
      }
    } catch {
      playTone('error');
      state.currentInput = 'Error';
      state.isEvaluated = true;
      el.statusIndicator.textContent = 'Syntax Error';
    }

    updateDisplay();
  }

  function clearAll() {
    playTone('func');
    state.currentInput = '0';
    state.expression = '';
    state.isEvaluated = false;
    el.statusIndicator.textContent = 'Ready';
    updateDisplay();
  }

  function backspace() {
    playTone('func');
    if (state.isEvaluated) {
      state.expression = '';
      state.isEvaluated = false;
      updateDisplay();
      return;
    }

    if (state.currentInput.length > 1 && state.currentInput !== 'Error' && state.currentInput !== 'Cannot divide by 0') {
      state.currentInput = state.currentInput.slice(0, -1);
    } else {
      state.currentInput = '0';
    }
    updateDisplay();
  }

  function negate() {
    playTone('func');
    if (state.currentInput === '0' || state.currentInput === 'Error') return;

    if (state.currentInput.startsWith('-')) {
      state.currentInput = state.currentInput.slice(1);
    } else {
      state.currentInput = '-' + state.currentInput;
    }
    updateDisplay();
  }

  function applyPercentage() {
    playTone('func');
    try {
      const val = parseFloat(state.currentInput);
      if (!isNaN(val)) {
        state.currentInput = String(roundPrecision(val / 100));
        updateDisplay();
      }
    } catch {
      state.currentInput = 'Error';
      updateDisplay();
    }
  }

  function inputParenthesis(paren) {
    playTone('func');
    if (state.isEvaluated) {
      state.expression = '';
      state.currentInput = '0';
      state.isEvaluated = false;
    }

    if (paren === '(') {
      if (state.currentInput === '0') {
        state.expression += '(';
      } else {
        state.expression += `${state.currentInput} × (`;
        state.currentInput = '0';
      }
    } else {
      state.expression += `${state.currentInput})`;
      state.currentInput = '0';
    }
    updateDisplay();
  }

  function applyScientific(funcKey) {
    playTone('func');
    el.statusIndicator.textContent = 'Scientific fx';
    const val = parseFloat(state.currentInput);

    switch (funcKey) {
      case 'sci-sin':
      case 'sci-cos':
      case 'sci-tan':
      case 'sci-asin':
      case 'sci-acos':
      case 'sci-atan':
      case 'sci-ln':
      case 'sci-log':
      case 'sci-sqrt':
      case 'sci-cbrt':
      case 'sci-abs': {
        const fnName = funcKey.replace('sci-', '');
        if (state.currentInput !== '0' && !state.isEvaluated) {
          try {
            const res = evaluateExpression(`${fnName}(${state.currentInput})`);
            if (res === 'Cannot divide by 0' || res === 'Error') {
              state.currentInput = res;
              state.isEvaluated = true;
            } else {
              const resStr = String(res);
              addHistoryItem(`${fnName}(${state.currentInput})`, resStr);
              state.expression = `${fnName}(${state.currentInput}) =`;
              state.currentInput = resStr;
              state.isEvaluated = true;
            }
          } catch {
            state.expression += `${fnName}(${state.currentInput})`;
            state.currentInput = '0';
          }
        } else {
          if (state.isEvaluated) {
            state.expression = `${fnName}(`;
            state.currentInput = '0';
            state.isEvaluated = false;
          } else {
            state.expression += `${fnName}(`;
            state.currentInput = '0';
          }
        }
        updateDisplay();
        break;
      }
      case 'sci-sqr': {
        if (!isNaN(val)) {
          const res = roundPrecision(Math.pow(val, 2));
          const resStr = String(res);
          addHistoryItem(`sqr(${state.currentInput})`, resStr);
          state.expression = `sqr(${state.currentInput}) =`;
          state.currentInput = resStr;
          state.isEvaluated = true;
          updateDisplay();
        }
        break;
      }
      case 'sci-inv': {
        if (val === 0) {
          state.currentInput = 'Cannot divide by 0';
          state.isEvaluated = true;
        } else if (!isNaN(val)) {
          const res = roundPrecision(1 / val);
          const resStr = String(res);
          addHistoryItem(`1/(${state.currentInput})`, resStr);
          state.expression = `1/(${state.currentInput}) =`;
          state.currentInput = resStr;
          state.isEvaluated = true;
        }
        updateDisplay();
        break;
      }
      case 'sci-fact': {
        if (!isNaN(val)) {
          const res = factorial(val);
          const resStr = isNaN(res) ? 'Error' : String(res);
          addHistoryItem(`${state.currentInput}!`, resStr);
          state.expression = `${state.currentInput}! =`;
          state.currentInput = resStr;
          state.isEvaluated = true;
          updateDisplay();
        }
        break;
      }
      case 'sci-pi': {
        state.currentInput = String(roundPrecision(Math.PI, 10));
        state.isEvaluated = false;
        updateDisplay();
        break;
      }
      case 'sci-e': {
        state.currentInput = String(roundPrecision(Math.E, 10));
        state.isEvaluated = false;
        updateDisplay();
        break;
      }
      case 'sci-exp': {
        if (!isNaN(val)) {
          const res = roundPrecision(Math.exp(val));
          const resStr = String(res);
          addHistoryItem(`e^(${state.currentInput})`, resStr);
          state.expression = `e^(${state.currentInput}) =`;
          state.currentInput = resStr;
          state.isEvaluated = true;
          updateDisplay();
        }
        break;
      }
      case 'sci-power': {
        inputOperator('^');
        break;
      }
    }
  }

  // =========================================================================
  // MEMORY FUNCTIONS
  // =========================================================================
  function handleMemory(action) {
    playTone('func');
    const curVal = parseFloat(state.currentInput) || 0;

    switch (action) {
      case 'mc':
        state.memory = 0;
        showToast('Memory Cleared (MC)');
        break;
      case 'mr':
        state.currentInput = String(state.memory);
        state.isEvaluated = false;
        showToast(`Memory Recalled: ${state.memory}`);
        break;
      case 'm-plus':
        state.memory += curVal;
        showToast(`Added to Memory: ${state.memory}`);
        break;
      case 'm-minus':
        state.memory -= curVal;
        showToast(`Subtracted from Memory: ${state.memory}`);
        break;
      case 'ms':
        state.memory = curVal;
        showToast(`Stored in Memory: ${state.memory}`);
        break;
    }

    if (state.memory !== 0) {
      el.memoryIndicator.classList.add('active');
    } else {
      el.memoryIndicator.classList.remove('active');
    }
    updateDisplay();
  }

  // =========================================================================
  // HISTORY MANAGEMENT
  // =========================================================================
  function loadHistory() {
    try {
      const stored = localStorage.getItem('aerocalc_history');
      if (stored) {
        state.history = JSON.parse(stored);
        renderHistory();
      }
    } catch {
      state.history = [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem('aerocalc_history', JSON.stringify(state.history.slice(0, 50)));
    } catch {
      // Ignore quota errors
    }
  }

  function addHistoryItem(expr, result) {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    state.history.unshift({ expr, result, timestamp });
    if (state.history.length > 50) state.history.pop();
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    el.historyBadge.textContent = state.history.length;
    if (state.history.length === 0) {
      el.historyList.innerHTML = `
        <div class="history-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p>No calculations yet</p>
          <span>Your past expressions and answers will appear here.</span>
        </div>`;
      return;
    }

    el.historyList.innerHTML = '';
    state.history.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'history-item';
      card.title = 'Click to use this result';
      card.innerHTML = `
        <div class="history-item-top">
          <span class="history-item-expr">${item.expr}</span>
          <span class="history-item-time">${item.timestamp}</span>
        </div>
        <div class="history-item-res">${item.result}</div>
      `;

      card.addEventListener('click', () => {
        playTone('func');
        state.currentInput = item.result;
        state.expression = `${item.expr} =`;
        state.isEvaluated = true;
        updateDisplay();
        showToast(`Loaded ${item.result} from history`);
      });

      el.historyList.appendChild(card);
    });
  }

  function clearHistory() {
    playTone('func');
    state.history = [];
    saveHistory();
    renderHistory();
    showToast('Calculation history cleared');
  }

  // =========================================================================
  // UNIT CONVERTER ENGINE
  // =========================================================================
  const CONVERTER_DATA = {
    length: {
      units: [
        { id: 'm', label: 'Meters (m)', factor: 1 },
        { id: 'km', label: 'Kilometers (km)', factor: 1000 },
        { id: 'cm', label: 'Centimeters (cm)', factor: 0.01 },
        { id: 'mm', label: 'Millimeters (mm)', factor: 0.001 },
        { id: 'mi', label: 'Miles (mi)', factor: 1609.344 },
        { id: 'yd', label: 'Yards (yd)', factor: 0.9144 },
        { id: 'ft', label: 'Feet (ft)', factor: 0.3048 },
        { id: 'in', label: 'Inches (in)', factor: 0.0254 }
      ]
    },
    weight: {
      units: [
        { id: 'kg', label: 'Kilograms (kg)', factor: 1 },
        { id: 'g', label: 'Grams (g)', factor: 0.001 },
        { id: 'mg', label: 'Milligrams (mg)', factor: 0.000001 },
        { id: 'lb', label: 'Pounds (lb)', factor: 0.45359237 },
        { id: 'oz', label: 'Ounces (oz)', factor: 0.028349523125 },
        { id: 't', label: 'Metric Tons (t)', factor: 1000 }
      ]
    },
    temperature: {
      units: [
        { id: 'c', label: 'Celsius (°C)' },
        { id: 'f', label: 'Fahrenheit (°F)' },
        { id: 'k', label: 'Kelvin (K)' }
      ]
    },
    area: {
      units: [
        { id: 'sqm', label: 'Square Meters (m²)', factor: 1 },
        { id: 'sqkm', label: 'Square Kilometers (km²)', factor: 1000000 },
        { id: 'sqft', label: 'Square Feet (ft²)', factor: 0.092903 },
        { id: 'acre', label: 'Acres (ac)', factor: 4046.8564224 },
        { id: 'ha', label: 'Hectares (ha)', factor: 10000 }
      ]
    },
    volume: {
      units: [
        { id: 'l', label: 'Liters (L)', factor: 1 },
        { id: 'ml', label: 'Milliliters (mL)', factor: 0.001 },
        { id: 'cum', label: 'Cubic Meters (m³)', factor: 1000 },
        { id: 'gal', label: 'Gallons (US gal)', factor: 3.78541 },
        { id: 'qt', label: 'Quarts (US qt)', factor: 0.946353 },
        { id: 'pt', label: 'Pints (US pt)', factor: 0.473176 },
        { id: 'cup', label: 'Cups (US cup)', factor: 0.236588 }
      ]
    },
    speed: {
      units: [
        { id: 'mps', label: 'Meters / second (m/s)', factor: 1 },
        { id: 'kmh', label: 'Kilometers / hour (km/h)', factor: 0.277778 },
        { id: 'mph', label: 'Miles / hour (mph)', factor: 0.44704 },
        { id: 'knot', label: 'Knots (kn)', factor: 0.514444 }
      ]
    },
    digital: {
      units: [
        { id: 'b', label: 'Bytes (B)', factor: 1 },
        { id: 'kb', label: 'Kilobytes (KB)', factor: 1024 },
        { id: 'mb', label: 'Megabytes (MB)', factor: 1048576 },
        { id: 'gb', label: 'Gigabytes (GB)', factor: 1073741824 },
        { id: 'tb', label: 'Terabytes (TB)', factor: 1099511627776 }
      ]
    },
    time: {
      units: [
        { id: 's', label: 'Seconds (s)', factor: 1 },
        { id: 'min', label: 'Minutes (min)', factor: 60 },
        { id: 'h', label: 'Hours (h)', factor: 3600 },
        { id: 'd', label: 'Days (d)', factor: 86400 },
        { id: 'wk', label: 'Weeks (wk)', factor: 604800 },
        { id: 'yr', label: 'Years (365d)', factor: 31536000 }
      ]
    }
  };

  function initConverter() {
    setupConverterCategory(state.activeCategory);

    // Event listeners
    el.convFromValue.addEventListener('input', runConversion);
    el.convFromUnit.addEventListener('change', runConversion);
    el.convToUnit.addEventListener('change', runConversion);

    el.convSwapBtn.addEventListener('click', () => {
      playTone('func');
      const temp = el.convFromUnit.value;
      el.convFromUnit.value = el.convToUnit.value;
      el.convToUnit.value = temp;
      runConversion();
    });

    el.converterCategories.addEventListener('click', (e) => {
      const tab = e.target.closest('.cat-tab');
      if (!tab) return;
      playTone('func');
      document.querySelectorAll('.cat-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeCategory = tab.dataset.cat;
      setupConverterCategory(state.activeCategory);
    });

    el.convSendToCalcBtn.addEventListener('click', () => {
      playTone('func');
      const toVal = el.convToValue.value;
      if (toVal && toVal !== 'Error') {
        state.currentInput = toVal;
        state.expression = `Converter: ${el.convFromValue.value} ${el.convFromUnit.value} →`;
        state.isEvaluated = true;
        switchMode('calc');
        updateDisplay();
        showToast(`Sent ${toVal} to Calculator!`);
      }
    });
  }

  function setupConverterCategory(catKey) {
    const cat = CONVERTER_DATA[catKey];
    if (!cat) return;

    el.convFromUnit.innerHTML = '';
    el.convToUnit.innerHTML = '';

    cat.units.forEach((u, i) => {
      const optFrom = new Option(u.label, u.id);
      const optTo = new Option(u.label, u.id);
      el.convFromUnit.add(optFrom);
      el.convToUnit.add(optTo);
    });

    // Pick sensible defaults (e.g. index 0 and index 1)
    if (cat.units.length > 1) {
      el.convFromUnit.selectedIndex = 0;
      el.convToUnit.selectedIndex = 1;
    }

    runConversion();
  }

  function runConversion() {
    const catKey = state.activeCategory;
    const cat = CONVERTER_DATA[catKey];
    const val = parseFloat(el.convFromValue.value);

    if (isNaN(val)) {
      el.convToValue.value = '';
      el.convFormulaText.textContent = 'Enter a valid numeric value';
      return;
    }

    const fromId = el.convFromUnit.value;
    const toId = el.convToUnit.value;

    let converted = 0;

    if (catKey === 'temperature') {
      // Temperature conversion
      let celsius = val;
      if (fromId === 'f') celsius = (val - 32) * (5 / 9);
      else if (fromId === 'k') celsius = val - 273.15;

      if (toId === 'c') converted = celsius;
      else if (toId === 'f') converted = celsius * (9 / 5) + 32;
      else if (toId === 'k') converted = celsius + 273.15;

      el.convFormulaText.textContent = `${val} °${fromId.toUpperCase()} = ${roundPrecision(converted, 4)} °${toId.toUpperCase()}`;
    } else {
      // Standard factor based conversion
      const fromUnit = cat.units.find((u) => u.id === fromId);
      const toUnit = cat.units.find((u) => u.id === toId);

      if (fromUnit && toUnit) {
        // base unit conversion
        const inBase = val * fromUnit.factor;
        converted = inBase / toUnit.factor;

        const sampleUnitConversion = roundPrecision(fromUnit.factor / toUnit.factor, 6);
        el.convFormulaText.textContent = `1 ${fromUnit.label.split(' ')[0]} = ${sampleUnitConversion} ${toUnit.label.split(' ')[0]}`;
      }
    }

    el.convToValue.value = String(roundPrecision(converted, 8));
  }

  // =========================================================================
  // VIEW & THEME SWITCHING
  // =========================================================================
  function switchMode(mode) {
    state.activeMode = mode;
    if (mode === 'calc') {
      el.modeCalcBtn.classList.add('active');
      el.modeConverterBtn.classList.remove('active');
      el.calcSection.classList.remove('hide');
      el.converterSection.classList.add('hide');
    } else {
      el.modeConverterBtn.classList.add('active');
      el.modeCalcBtn.classList.remove('active');
      el.converterSection.classList.remove('hide');
      el.calcSection.classList.add('hide');
      runConversion();
    }
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('aerocalc_theme');
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }

  function setTheme(theme) {
    state.theme = theme;
    el.body.setAttribute('data-theme', theme);
    localStorage.setItem('aerocalc_theme', theme);

    const moon = el.themeToggleBtn.querySelector('.icon-moon');
    const sun = el.themeToggleBtn.querySelector('.icon-sun');

    if (theme === 'dark') {
      moon.classList.remove('hide');
      sun.classList.add('hide');
    } else {
      moon.classList.add('hide');
      sun.classList.remove('hide');
    }
  }

  function toggleTheme() {
    playTone('func');
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  function toggleSound() {
    state.isSoundEnabled = !state.isSoundEnabled;
    const soundOn = el.soundToggleBtn.querySelector('.icon-sound-on');
    const soundOff = el.soundToggleBtn.querySelector('.icon-sound-off');

    if (state.isSoundEnabled) {
      soundOn.classList.remove('hide');
      soundOff.classList.add('hide');
      showToast('Sound Feedback Enabled');
      playTone('func');
    } else {
      soundOn.classList.add('hide');
      soundOff.classList.remove('hide');
      showToast('Sound Feedback Muted');
    }
    localStorage.setItem('aerocalc_sound', state.isSoundEnabled);
  }

  function toggleScientific() {
    playTone('func');
    state.isScientificExpanded = !state.isScientificExpanded;
    el.scientificKeypad.classList.toggle('collapsed', !state.isScientificExpanded);
    el.sciToggleBtn.classList.toggle('expanded', state.isScientificExpanded);
    el.appContainer.classList.toggle('expanded-sci', state.isScientificExpanded);
  }

  function toggleHistoryDrawer() {
    playTone('func');
    const isOpen = el.historyDrawer.classList.toggle('open');
    el.appContainer.classList.toggle('with-drawer', isOpen);
  }

  function toggleAngleMode() {
    playTone('func');
    state.angleMode = state.angleMode === 'DEG' ? 'RAD' : 'DEG';
    const activeSpan = el.angleModeBtn.querySelector('.pill-active');
    const inactiveSpan = el.angleModeBtn.querySelector('.pill-inactive');

    if (state.angleMode === 'DEG') {
      activeSpan.textContent = 'DEG';
      inactiveSpan.textContent = 'RAD';
      showToast('Angle Mode: Degrees (DEG)');
    } else {
      activeSpan.textContent = 'RAD';
      inactiveSpan.textContent = 'DEG';
      showToast('Angle Mode: Radians (RAD)');
    }
  }

  function copyDisplayToClipboard() {
    const textToCopy = state.currentInput;
    if (!textToCopy || textToCopy === 'Error') return;

    playTone('func');
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast(`Copied ${textToCopy} to clipboard!`);
    }).catch(() => {
      showToast(`Copied ${textToCopy}`);
    });
  }

  // =========================================================================
  // EVENT LISTENERS & DELEGATION
  // =========================================================================
  function initEventListeners() {
    // Top Nav buttons
    el.modeCalcBtn.addEventListener('click', () => {
      playTone('func');
      switchMode('calc');
    });

    el.modeConverterBtn.addEventListener('click', () => {
      playTone('func');
      switchMode('converter');
    });

    el.themeToggleBtn.addEventListener('click', toggleTheme);
    el.soundToggleBtn.addEventListener('click', toggleSound);
    el.historyToggleBtn.addEventListener('click', toggleHistoryDrawer);
    el.closeHistoryBtn.addEventListener('click', toggleHistoryDrawer);
    el.clearHistoryBtn.addEventListener('click', clearHistory);
    el.angleModeBtn.addEventListener('click', toggleAngleMode);
    el.sciToggleBtn.addEventListener('click', toggleScientific);

    // Copy result
    el.copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyDisplayToClipboard();
    });
    el.displayContainer.addEventListener('click', copyDisplayToClipboard);

    // Help Shortcuts Modal
    el.helpModalBtn.addEventListener('click', () => {
      playTone('func');
      el.shortcutsModal.classList.remove('hide');
    });
    el.closeModalBtn.addEventListener('click', () => {
      playTone('func');
      el.shortcutsModal.classList.add('hide');
    });
    el.shortcutsModal.addEventListener('click', (e) => {
      if (e.target === el.shortcutsModal) {
        el.shortcutsModal.classList.add('hide');
      }
    });

    // Keypad Event Delegation (Calculator)
    el.calcSection.addEventListener('click', (e) => {
      const target = e.target.closest('button');
      if (!target) return;

      // Digits
      if (target.dataset.num !== undefined) {
        inputDigit(target.dataset.num);
        return;
      }

      // Actions
      const action = target.dataset.action;
      if (!action) return;

      switch (action) {
        case 'clear':
          clearAll();
          break;
        case 'decimal':
          inputDecimal();
          break;
        case 'backspace':
          backspace();
          break;
        case 'negate':
          negate();
          break;
        case 'percent':
          applyPercentage();
          break;
        case 'paren-open':
          inputParenthesis('(');
          break;
        case 'paren-close':
          inputParenthesis(')');
          break;
        case 'add':
          inputOperator('+');
          break;
        case 'subtract':
          inputOperator('−');
          break;
        case 'multiply':
          inputOperator('×');
          break;
        case 'divide':
          inputOperator('÷');
          break;
        case 'calculate':
          calculateResult();
          break;
        case 'ans':
          playTone('func');
          if (state.previousAnswer !== null) {
            state.currentInput = state.previousAnswer;
            state.isEvaluated = false;
            updateDisplay();
            showToast(`Recalled Answer: ${state.previousAnswer}`);
          }
          break;

        // Memory actions
        case 'mc':
        case 'mr':
        case 'm-plus':
        case 'm-minus':
        case 'ms':
          handleMemory(action);
          break;

        // Scientific actions
        default:
          if (action.startsWith('sci-')) {
            applyScientific(action);
          }
          break;
      }
    });

    // Global Keyboard Support
    window.addEventListener('keydown', handleKeyboard);
  }

  // =========================================================================
  // KEYBOARD HANDLER
  // =========================================================================
  function handleKeyboard(e) {
    // If user is focused on converter input, let them type normally
    if (document.activeElement === el.convFromValue) {
      return;
    }

    const key = e.key;

    // Shortcuts Modal Close / Open
    if (key === 'Escape') {
      if (!el.shortcutsModal.classList.contains('hide')) {
        el.shortcutsModal.classList.add('hide');
        return;
      }
      if (el.historyDrawer.classList.contains('open')) {
        toggleHistoryDrawer();
        return;
      }
      clearAll();
      return;
    }

    if (key === '?' || (e.shiftKey && key === '/')) {
      e.preventDefault();
      el.shortcutsModal.classList.toggle('hide');
      return;
    }

    // Toggle Scientific Panel Alt+s
    if (e.altKey && (key === 's' || key === 'S')) {
      e.preventDefault();
      toggleScientific();
      return;
    }

    // Hotkey for History Drawer
    if (key === 'h' || key === 'H') {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleHistoryDrawer();
        return;
      }
    }

    // Hotkey for Theme Toggle
    if (key === 't' || key === 'T') {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleTheme();
        return;
      }
    }

    // Hotkey for Sound Toggle
    if (key === 'm' || key === 'M') {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleSound();
        return;
      }
    }

    // Standard Math inputs
    if (/^[0-9]$/.test(key)) {
      e.preventDefault();
      inputDigit(key);
    } else if (key === '.') {
      e.preventDefault();
      inputDecimal();
    } else if (key === '+' || key === '=') {
      if (key === '+' || e.shiftKey) {
        e.preventDefault();
        inputOperator('+');
      } else {
        e.preventDefault();
        calculateResult();
      }
    } else if (key === '-') {
      e.preventDefault();
      inputOperator('−');
    } else if (key === '*' || key === 'x' || key === 'X') {
      e.preventDefault();
      inputOperator('×');
    } else if (key === '/') {
      e.preventDefault();
      inputOperator('÷');
    } else if (key === '^') {
      e.preventDefault();
      inputOperator('^');
    } else if (key === '%') {
      e.preventDefault();
      applyPercentage();
    } else if (key === '(' || key === ')') {
      e.preventDefault();
      inputParenthesis(key);
    } else if (key === 'Enter') {
      e.preventDefault();
      calculateResult();
    } else if (key === 'Backspace') {
      e.preventDefault();
      backspace();
    } else if (key === 'c' || key === 'C') {
      e.preventDefault();
      clearAll();
    } else if (key === 's' || key === 'r') {
      // Square root
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        applyScientific('sci-sqrt');
      }
    }
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  function init() {
    initTheme();
    loadHistory();
    initConverter();
    initEventListeners();
    updateDisplay();

    // Load saved sound preference
    const savedSound = localStorage.getItem('aerocalc_sound');
    if (savedSound !== null) {
      state.isSoundEnabled = savedSound === 'true';
      if (!state.isSoundEnabled) {
        el.soundToggleBtn.querySelector('.icon-sound-on').classList.add('hide');
        el.soundToggleBtn.querySelector('.icon-sound-off').classList.remove('hide');
      }
    }
  }

  // Start app when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
