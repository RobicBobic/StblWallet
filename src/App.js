/*
  STBL — Full Production App
  ─────────────────────────────────────────────────────
  Live APIs used:
    • CoinGecko  — real-time prices (free, no key)
    • Jupiter v6 — real on-chain swap quotes + tx
    • Phantom    — wallet signing + broadcast

  @solana/web3.js is loaded from CDN at runtime (no npm install needed)
*/

import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

/* ═══════════════════════════════════════════════════════
   TOKEN & CHAIN CONFIGURATION
═══════════════════════════════════════════════════════ */

const TOKEN_CFG = {
  SOL: {
    name: 'Solana',
    symbol: 'SOL',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
    cgId: 'solana',
    cgUrl: 'https://www.coingecko.com/en/coins/solana',
    scanUrl: 'https://solscan.io',
  },
  USDC: {
    name: 'USD Coin',
    symbol: 'USDC',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    cgId: 'usd-coin',
    cgUrl: 'https://www.coingecko.com/en/coins/usd-coin',
    scanUrl: 'https://solscan.io/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
  USDT: {
    name: 'Tether',
    symbol: 'USDT',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
    cgId: 'tether',
    cgUrl: 'https://www.coingecko.com/en/coins/tether',
    scanUrl: 'https://solscan.io/token/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
};

const DISPLAY_TOKENS = {
  SOL:  { ...TOKEN_CFG.SOL },
  BTC:  {
    name: 'Bitcoin', symbol: 'BTC', decimals: 8,
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
    cgId: 'bitcoin', cgUrl: 'https://www.coingecko.com/en/coins/bitcoin',
  },
  ETH:  {
    name: 'Ethereum', symbol: 'ETH', decimals: 18,
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    cgId: 'ethereum', cgUrl: 'https://www.coingecko.com/en/coins/ethereum',
  },
  USDC: { ...TOKEN_CFG.USDC },
  USDT: { ...TOKEN_CFG.USDT },
};

const CHAIN_CFG = [
  {
    id: 'base',
    name: 'Base',
    type: 'EVM',
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
    explorer: 'https://basescan.org',
    docsUrl: 'https://docs.base.org',
    tokens: ['USDC'],
  },
  {
    id: 'solana',
    name: 'Solana',
    type: 'SVM',
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
    explorer: 'https://solscan.io',
    docsUrl: 'https://solana.com/developers',
    tokens: ['USDC', 'USDT'],
  },
  {
    id: 'polygon',
    name: 'Polygon',
    type: 'EVM',
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
    explorer: 'https://polygonscan.com',
    docsUrl: 'https://docs.polygon.technology',
    tokens: ['USDC', 'USDT'],
  },
];

/* ═══════════════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════════════ */
const truncate = (a) => a ? `${a.slice(0, 4)}...${a.slice(-4)}` : '';
const fmt = (n, d = 6) => {
  const s = Number(n).toFixed(d);
  return s.replace(/\.?0+$/, '');
};
const fmtUSD = (n) => {
  const num = Number(n);
  if (num >= 1000)  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (num >= 1)     return `$${parseFloat(num.toFixed(2)).toString()}`;
  if (num >= 0.01)  return `$${parseFloat(num.toFixed(4)).toString()}`;
  return `$${parseFloat(num.toFixed(6)).toString()}`;
};
const fmtChange = (c) => c !== undefined ? `${c >= 0 ? '+' : ''}${Number(c).toFixed(2)}%` : '';

/* ═══════════════════════════════════════════════════════
   PHANTOM WALLET HOOK
═══════════════════════════════════════════════════════ */
function usePhantom() {
  const [wallet, setWallet] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const provider = typeof window !== 'undefined' ? window?.solana : null;

  const connect = useCallback(async () => {
    setError('');
    if (!provider?.isPhantom) {
      window.open('https://phantom.app/', '_blank');
      setError('Phantom not found — opening phantom.app to install');
      return;
    }
    try {
      setConnecting(true);
      const resp = await provider.connect();
      setWallet({ publicKey: resp.publicKey.toString() });
    } catch (e) {
      setError(e.message === 'User rejected the request.' ? 'Connection cancelled' : (e.message || 'Connection failed'));
    } finally {
      setConnecting(false);
    }
  }, [provider]);

  const disconnect = useCallback(async () => {
    try { if (provider) await provider.disconnect(); } catch (_) {}
    setWallet(null);
  }, [provider]);

  useEffect(() => {
    if (provider?.isPhantom) {
      provider.connect({ onlyIfTrusted: true })
        .then(resp => setWallet({ publicKey: resp.publicKey.toString() }))
        .catch(() => {});
    }
  }, [provider]);

  return { wallet, connecting, error, connect, disconnect };
}

/* ═══════════════════════════════════════════════════════
   LIVE PRICE HOOK (CoinGecko)
═══════════════════════════════════════════════════════ */
function useLivePrices() {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana,bitcoin,ethereum,usd-coin,tether&vs_currencies=usd&include_24hr_change=true'
      );
      const d = await res.json();
      setPrices({
        SOL:  { price: d.solana?.usd,       change: d.solana?.usd_24h_change },
        BTC:  { price: d.bitcoin?.usd,      change: d.bitcoin?.usd_24h_change },
        ETH:  { price: d.ethereum?.usd,     change: d.ethereum?.usd_24h_change },
        USDC: { price: d['usd-coin']?.usd,  change: d['usd-coin']?.usd_24h_change },
        USDT: { price: d.tether?.usd,       change: d.tether?.usd_24h_change },
      });
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 30000);
    return () => clearInterval(id);
  }, [fetch_]);

  return { prices, loading };
}

/* ═══════════════════════════════════════════════════════
   SOLANA WEB3.JS — LAZY CDN LOADER
═══════════════════════════════════════════════════════ */
let _web3Promise = null;
function loadWeb3() {
  if (_web3Promise) return _web3Promise;
  _web3Promise = new Promise((resolve, reject) => {
    if (window.solanaWeb3) { resolve(window.solanaWeb3); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@solana/web3.js@1.95.4/lib/index.iife.min.js';
    s.onload = () => resolve(window.solanaWeb3);
    s.onerror = () => reject(new Error('Failed to load @solana/web3.js'));
    document.head.appendChild(s);
  });
  return _web3Promise;
}

/* ═══════════════════════════════════════════════════════
   JUPITER API
═══════════════════════════════════════════════════════ */
async function jupiterQuote(inputMint, outputMint, amountRaw) {
  const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountRaw}&slippageBps=50`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function jupiterSwap(quoteResponse, userPublicKey) {
  const res = await fetch('https://quote-api.jup.ag/v6/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteResponse, userPublicKey, wrapAndUnwrapSol: true }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function executeSwap(quote, publicKey) {
  const { swapTransaction } = await jupiterSwap(quote, publicKey);
  const web3 = await loadWeb3();
  const bytes = Uint8Array.from(atob(swapTransaction), c => c.charCodeAt(0));
  const tx = web3.VersionedTransaction.deserialize(bytes);
  const { signature } = await window.solana.signAndSendTransaction(tx);
  return signature;
}

/* ═══════════════════════════════════════════════════════
   STAR FIELD
═══════════════════════════════════════════════════════ */
/* ── CANVAS STAR FIELD — single GPU layer, zero CSS animations ──
   All 193 stars drawn on one <canvas> via requestAnimationFrame.
   Dramatically cheaper than 193 animated DOM nodes.
─────────────────────────────────────────────────────────────── */
function GlobalStarField() {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const starsRef  = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    /* Build star data once */
    const makeStars = (w, h) => {
      const list = [];
      const add = (count, minR, maxR, minOp, maxOp, minSpeed, maxSpeed) => {
        for (let i = 0; i < count; i++) {
          const period = minSpeed + Math.random() * (maxSpeed - minSpeed);
          list.push({
            x:      Math.random() * w,
            y:      Math.random() * h,
            r:      minR + Math.random() * (maxR - minR),
            minOp,
            maxOp:  minOp + Math.random() * (maxOp - minOp),
            period,
            offset: Math.random() * period,   // phase offset so not all in sync
          });
        }
      };
      add(140, 0.5, 1.0, 0.15, 0.55, 3000, 7000);   // dim tiny
      add(45,  1.0, 1.6, 0.30, 0.80, 2500, 5500);   // medium
      add(8,   1.6, 2.6, 0.55, 1.00, 2000, 4000);   // bright
      return list;
    };

    /* Resize canvas to fill viewport */
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      starsRef.current = makeStars(canvas.width, canvas.height);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);

    /* Animation loop — draws all stars each frame */
    const draw = (ts) => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      for (const s of starsRef.current) {
        /* Sinusoidal pulse: 0→1→0 over s.period ms */
        const t   = ((ts + s.offset) % s.period) / s.period;
        const sin = Math.sin(t * Math.PI);               // 0→1→0
        const op  = s.minOp + (s.maxOp - s.minOp) * sin;

        ctx.globalAlpha = op;
        ctx.fillStyle   = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      rafRef.current  = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block',
        background: '#000',
      }}
    />
  );
}

/* Legacy alias used in Hero JSX — no-op */
function StarField() { return null; }

/* ═══════════════════════════════════════════════════════
   TOKEN LOGO IMAGE
═══════════════════════════════════════════════════════ */
function TokenLogo({ symbol, size = 22, className = '' }) {
  const cfg = DISPLAY_TOKENS[symbol];
  const [err, setErr] = useState(false);
  if (!cfg || err) {
    return (
      <span className={`token-logo-fallback ${className}`} style={{ width: size, height: size, fontSize: size * 0.45 }}>
        {symbol?.[0]}
      </span>
    );
  }
  return (
    <img
      src={cfg.logo}
      alt={symbol}
      className={`token-logo-img ${className}`}
      width={size}
      height={size}
      onError={() => setErr(true)}
      style={{ borderRadius: '50%' }}
    />
  );
}

/* ═══════════════════════════════════════════════════════
   LIVE PRICE TICKER STRIP
═══════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════
   CONTRACT ADDRESS BAR
═══════════════════════════════════════════════════════ */
const CA_ADDRESS = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

function CABar() {
  return (
    <div className="ca-bar">
      <span className="ca-bar__label">CA:</span>
    </div>
  );
}


function PriceTicker() {
  const { prices } = useLivePrices();
  const tokens = ['BTC', 'ETH', 'SOL', 'USDC', 'USDT'];
  return (
    <div className="price-ticker">
      <div className="price-ticker__track">
        {[...tokens, ...tokens].map((sym, i) => {
          const p = prices[sym];
          const pos = p?.change >= 0;
          return (
            <a
              key={i}
              className="price-ticker__item"
              href={DISPLAY_TOKENS[sym]?.cgUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <TokenLogo symbol={sym} size={18} />
              <span className="price-ticker__sym">{sym}</span>
              <span className="price-ticker__price">
                {p ? fmtUSD(p.price) : '···'}
              </span>
              {p?.change !== undefined && (
                <span className={`price-ticker__change price-ticker__change--${pos ? 'up' : 'down'}`}>
                  {fmtChange(p.change)}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   3D CREDIT CARD
═══════════════════════════════════════════════════════ */
function CreditCard() {
  return (
    <div className="card-scene">
      <div className="card-wrap">
        {/* FRONT */}
        <div className="card-face card-front">
          <div className="card-shimmer" />
          <div className="card-top">
            <div className="card-brand">
              <div className="card-brand-sphere" />
              <span className="card-brand-name">STBL</span>
            </div>
            <div className="card-chip"><div className="card-chip-center" /></div>
          </div>
          <div className="card-nfc">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
              <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <circle cx="12" cy="20" r="1.2" fill="rgba(255,255,255,0.3)" stroke="none"/>
            </svg>
          </div>
          <div className="card-number"><span>4716</span><span>••••</span><span>••••</span><span>8823</span></div>
          <div className="card-bottom">
            <div className="card-field">
              <div className="card-field-label">Card Holder</div>
              <div className="card-field-value">STBL USER</div>
            </div>
            <div className="card-field">
              <div className="card-field-label">Expires</div>
              <div className="card-field-value">12/28</div>
            </div>
            <div className="card-mc"><div className="card-mc-l" /><div className="card-mc-r" /></div>
          </div>
        </div>
        {/* BACK */}
        <div className="card-face card-back">
          <div className="card-shimmer" />
          <div className="card-magstripe" />
          <div className="card-sig-row">
            <div className="card-sig-strip">
              {Array.from({length:14}).map((_,i)=><div key={i} className="card-sig-line"/>)}
            </div>
            <div className="card-cvv">
              <div className="card-cvv-label">CVV</div>
              <div className="card-cvv-value">•••</div>
            </div>
          </div>
          <div className="card-back-brand">
            <div className="card-brand"><div className="card-brand-sphere"/><span className="card-brand-name">STBL</span></div>
          </div>
          <div className="card-back-tagline">Powered by stablecoin rails · Non-custodial · Instant settlement</div>
          <div className="card-back-bottom">
            <div className="card-mc"><div className="card-mc-l"/><div className="card-mc-r"/></div>
          </div>
        </div>
      </div>
      <div className="card-floor-glow" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CRYPTO CONVERTER  — fully on-chain via Jupiter + Phantom
═══════════════════════════════════════════════════════ */
const SWAP_TOKENS = ['SOL', 'USDC', 'USDT'];

function TokenSelect({ value, onChange, exclude, disabled }) {
  return (
    <div className="conv-token-select">
      {SWAP_TOKENS.filter(t => t !== exclude).map(sym => (
        <button
          key={sym}
          className={`conv-token-btn${value === sym ? ' conv-token-btn--active' : ''}`}
          onClick={() => onChange(sym)}
          disabled={disabled}
        >
          <TokenLogo symbol={sym} size={20} />
          <span>{sym}</span>
        </button>
      ))}
    </div>
  );
}

function CryptoConverter() {
  const { wallet, connecting, error: walletErr, connect, disconnect } = usePhantom();
  const { prices } = useLivePrices();

  const [from, setFrom] = useState('SOL');
  const [to, setTo] = useState('USDC');
  const [amt, setAmt] = useState('1');
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteErr, setQuoteErr] = useState('');
  const [swapping, setSwapping] = useState(false);
  const [txSig, setTxSig] = useState('');
  const [swapErr, setSwapErr] = useState('');
  const debounce = useRef(null);

  // Fetch quote whenever inputs change
  useEffect(() => {
    setQuote(null);
    setQuoteErr('');
    setTxSig('');
    if (!amt || isNaN(+amt) || +amt <= 0) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const fc = TOKEN_CFG[from];
        const tc = TOKEN_CFG[to];
        const raw = Math.floor(+amt * 10 ** fc.decimals);
        const q = await jupiterQuote(fc.mint, tc.mint, raw);
        setQuote(q);
      } catch (e) {
        setQuoteErr('Quote unavailable: ' + (e.message || 'try again'));
      } finally {
        setQuoteLoading(false);
      }
    }, 600);
  }, [from, to, amt]);

  const outAmt = quote
    ? fmt(Number(quote.outAmount) / 10 ** TOKEN_CFG[to].decimals)
    : '';

  const priceImpact = quote?.priceImpactPct
    ? `${(Number(quote.priceImpactPct) * 100).toFixed(3)}%`
    : null;

  const handleFlip = () => {
    setFrom(to); setTo(from);
    setAmt(outAmt || '1');
    setQuote(null);
  };

  const handleSwap = async () => {
    if (!wallet || !quote) return;
    setSwapping(true); setSwapErr(''); setTxSig('');
    try {
      const sig = await executeSwap(quote, wallet.publicKey);
      setTxSig(sig);
      setAmt('1'); setQuote(null);
    } catch (e) {
      setSwapErr(e.message || 'Swap failed. Please try again.');
    } finally {
      setSwapping(false);
    }
  };

  const fromPrice = prices[from]?.price;
  const usdValue  = fromPrice && amt ? (fromPrice * +amt).toLocaleString(undefined, { maximumFractionDigits: 2 }) : null;

  return (
    <section className="converter" id="converter">
      <div className="converter__inner">
        <div className="section-header">
          <h2 className="section-header__title">Crypto Converter</h2>
          <p className="section-header__sub">
            Real on-chain swaps via Jupiter aggregator. Connect Phantom and swap SOL, USDC and USDT instantly at best-available rates.
          </p>
          <div className="section-header__divider" />
        </div>

        <div className="conv-card">
          {/* Wallet header */}
          <div className="conv-wallet-row">
            {wallet ? (
              <div className="conv-wallet-info">
                <span className="conv-wallet-dot" />
                <a
                  className="conv-wallet-addr"
                  href={`https://solscan.io/account/${wallet.publicKey}`}
                  target="_blank" rel="noopener noreferrer"
                  title="View on Solscan"
                >
                  {truncate(wallet.publicKey)}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
                <button className="conv-disconnect" onClick={disconnect}>Disconnect</button>
              </div>
            ) : (
              <button className="conv-connect-btn" onClick={connect} disabled={connecting}>
                {connecting ? <><span className="spinner" />Connecting…</> : <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
                  Connect Phantom Wallet
                </>}
              </button>
            )}
            {walletErr && <div className="conv-error">{walletErr}</div>}
          </div>

          <div className={`conv-body${!wallet ? ' conv-body--locked' : ''}`}>
            {!wallet && (
              <div className="conv-lock">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <p>Connect Phantom to swap</p>
              </div>
            )}

            {/* FROM field */}
            <div className="conv-field">
              <div className="conv-field-header">
                <span className="conv-field-label">From</span>
                {usdValue && <span className="conv-field-usd">≈ ${usdValue}</span>}
              </div>
              <div className="conv-field-input-row">
                <input
                  className="conv-amount-input"
                  type="number" min="0" placeholder="0.00"
                  value={amt}
                  onChange={e => setAmt(e.target.value)}
                  disabled={!wallet}
                />
                <TokenLogo symbol={from} size={28} />
                <span className="conv-field-sym">{from}</span>
              </div>
              <TokenSelect value={from} onChange={v => { setFrom(v); if(v===to) setTo(from); }} exclude={to} disabled={!wallet} />
            </div>

            {/* Flip button */}
            <button className="conv-flip-btn" onClick={handleFlip} disabled={!wallet} title="Flip tokens">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M7 16V4m0 0L3 8m4-4 4 4"/>
                <path d="M17 8v12m0 0 4-4m-4 4-4-4"/>
              </svg>
            </button>

            {/* TO field */}
            <div className="conv-field">
              <div className="conv-field-header">
                <span className="conv-field-label">To</span>
                {quoteLoading && <span className="conv-field-usd">Fetching quote…</span>}
              </div>
              <div className="conv-field-input-row">
                <input
                  className="conv-amount-input conv-amount-input--out"
                  type="number" placeholder="0.00"
                  value={outAmt}
                  readOnly
                />
                <TokenLogo symbol={to} size={28} />
                <span className="conv-field-sym">{to}</span>
              </div>
              <TokenSelect value={to} onChange={v => { setTo(v); if(v===from) setFrom(to); }} exclude={from} disabled={!wallet} />
            </div>

            {/* Quote details */}
            {quote && !quoteLoading && (
              <div className="conv-details">
                <div className="conv-detail-row">
                  <span>Rate</span>
                  <span>1 {from} ≈ {fmt(Number(quote.outAmount) / 10 ** TOKEN_CFG[to].decimals / +amt, 4)} {to}</span>
                </div>
                {priceImpact && (
                  <div className="conv-detail-row">
                    <span>Price impact</span>
                    <span className={Number(quote.priceImpactPct) > 0.01 ? 'conv-warn' : ''}>{priceImpact}</span>
                  </div>
                )}
                <div className="conv-detail-row">
                  <span>Route</span>
                  <span>{quote.routePlan?.length ?? 1} hop{quote.routePlan?.length !== 1 ? 's' : ''} via Jupiter</span>
                </div>
                <div className="conv-detail-row">
                  <span>Network fee</span>
                  <span>~0.000005 SOL</span>
                </div>
              </div>
            )}

            {quoteErr && <div className="conv-error">{quoteErr}</div>}
            {swapErr  && <div className="conv-error conv-error--swap">{swapErr}</div>}

            {/* Success */}
            {txSig && (
              <div className="conv-success">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Swap confirmed —{' '}
                <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer">
                  View on Solscan
                </a>
              </div>
            )}

            {/* CTA */}
            <button
              className={`conv-cta${txSig ? ' conv-cta--done' : ''}`}
              onClick={handleSwap}
              disabled={!wallet || !quote || swapping || quoteLoading || !amt || +amt <= 0}
            >
              {swapping ? (
                <><span className="spinner spinner--dark" />Awaiting Phantom approval…</>
              ) : txSig ? (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Swapped successfully</>
              ) : quoteLoading ? (
                <><span className="spinner spinner--dark" />Getting best rate…</>
              ) : (
                `Swap ${from} → ${to}`
              )}
            </button>

            <p className="conv-note">
              Powered by{' '}
              <a href="https://jup.ag" target="_blank" rel="noopener noreferrer">Jupiter Aggregator</a>
              {' '}· Slippage 0.5% · Non-custodial
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   NAVBAR
═══════════════════════════════════════════════════════ */
function Navbar() {
  const { wallet, connecting, connect, disconnect } = usePhantom();

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <nav className="navbar">
      <button className="navbar__logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <div className="navbar__logo-sphere" />
        STBL
      </button>
      <div className="navbar__links">
        <button onClick={() => scrollTo('how-it-works')}>How it works</button>
        <button onClick={() => scrollTo('converter')}>Converter</button>
        <button onClick={() => scrollTo('developers')}>Developers</button>
        <button onClick={() => scrollTo('pricing')}>Pricing</button>
      </div>
      <div className="navbar__right">
        {wallet ? (
          <div className="navbar__wallet-pill" onClick={disconnect} title="Click to disconnect">
            <span className="navbar__wallet-dot" />
            {truncate(wallet.publicKey)}
          </div>
        ) : (
          <button className="btn-primary-sm" onClick={connect} disabled={connecting}>
            {connecting ? 'Connecting…' : 'Connect Phantom'}
          </button>
        )}
      </div>
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════
   HERO
═══════════════════════════════════════════════════════ */
function Hero() {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  return (
    <section className="hero">
      <div className="hero__glow" />
      <StarField />
      <div className="hero__inner">
        <div className="hero__copy">
          <div className="hero__badge"><span className="hero__badge-dot" />0% Fees · Live on Solana</div>
          <h1 className="hero__title">
            <span className="hero__title-bright">Accept</span>
            <span className="hero__title-bright">Stablecoins</span>
            <span className="hero__title-dim">Anywhere</span>
          </h1>
          <p className="hero__sub">
            Integrate crypto payments in minutes, not months. No chargebacks. No middlemen. Direct to your wallet.
          </p>
          <div className="hero__ctas">
            <button className="btn-hero-white" onClick={() => scrollTo('converter')}>
              Try Converter →
            </button>
            <button className="btn-hero-dark"
              onClick={() => window.open('https://docs.phantom.app/integrating-phantom/deeplinks-ios-and-android', '_blank')}>
              Developer docs
            </button>
            <a
              className="btn-hero-twitter"
              href="https://twitter.com/stbl_io"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Twitter
            </a>
          </div>
          <div className="hero__mini-stats">
            <div className="hero__mini-stat"><span className="hero__mini-val">0%</span><span className="hero__mini-label">Fees</span></div>
            <div className="hero__mini-divider" />
            <div className="hero__mini-stat"><span className="hero__mini-val">&lt;1s</span><span className="hero__mini-label">Settlement</span></div>
            <div className="hero__mini-divider" />
            <div className="hero__mini-stat"><span className="hero__mini-val">∞</span><span className="hero__mini-label">Transactions</span></div>
          </div>
        </div>
        <div className="hero__card-area"><CreditCard /></div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   STATS BAR
═══════════════════════════════════════════════════════ */
function StatsBar() {
  return (
    <div className="stats-bar">
      {[{ value:'0%',label:'Fee' },{ value:'< 1s',label:'Settlement' },{ value:'∞',label:'Transactions' },{ value:'$0',label:'Setup Cost' }].map(s=>(
        <div key={s.label} className="stats-bar__item">
          <div className="stats-bar__value">{s.value}</div>
          <div className="stats-bar__label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   GLOBAL LIQUIDITY  — with real chain + token logos
═══════════════════════════════════════════════════════ */
function ChainLogo({ src, alt, fallbackLetter }) {
  const [err, setErr] = useState(false);
  if (err) return <span className="chain-logo-fallback">{fallbackLetter}</span>;
  return <img src={src} alt={alt} className="chain-logo-img" onError={() => setErr(true)} />;
}

function GlobalLiquidity() {
  return (
    <section className="liquidity" id="liquidity">
      <div className="section-header">
        <h2 className="section-header__title">Global stablecoin liquidity</h2>
        <p className="section-header__sub">Accept the most liquid stablecoins across the fastest blockchain networks. Fully non-custodial and direct-to-wallet.</p>
        <div className="section-header__divider" />
      </div>
      <div className="chain-grid">
        {CHAIN_CFG.map(chain => (
          <a
            key={chain.id}
            className="chain-card"
            href={chain.explorer}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="chain-card__header">
              <div className="chain-card__icon">
                <ChainLogo src={chain.logo} alt={chain.name} fallbackLetter={chain.name[0]} />
              </div>
              <div>
                <div className="chain-card__name">{chain.name}</div>
                <div className="chain-card__type">{chain.type}</div>
              </div>
              <div className="chain-card__ext-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </div>
            </div>
            <div className="chain-card__supported-label">Supported</div>
            <div className="token-badges">
              {chain.tokens.map(sym => (
                <span
                  key={sym}
                  className="token-badge"
                  onClick={e => { e.preventDefault(); window.open(DISPLAY_TOKENS[sym]?.cgUrl, '_blank'); }}
                  title={`View ${sym} on CoinGecko`}
                >
                  <TokenLogo symbol={sym} size={16} />
                  {sym}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   CHECKOUT FLOW
═══════════════════════════════════════════════════════ */
const FLOW_STEPS = [
  { num: '01', icon: '</>', name: 'Integrate',  desc: 'Add our SDK or use the hosted checkout. Works with any stack.' },
  { num: '02', icon: 'Pay', name: 'Checkout',   desc: 'Your customers pay in USDC/USDT. You receive directly to your wallet.' },
  { num: '03', icon: '$',   name: 'Get paid',   desc: 'Instant settlement. No holding period. Access funds immediately.' },
];

function CheckoutFlow() {
  return (
    <section className="flow" id="how-it-works">
      <div className="flow__inner">
        <h2 className="flow__heading">The checkout flow, simplified</h2>
        <p className="flow__sub">Three steps to start accepting crypto. No complex onboarding required.</p>
        <div className="flow__divider" />
        <div className="flow__steps">
          {FLOW_STEPS.map(step => (
            <div key={step.num}>
              <div className="flow__step-num">{step.num}</div>
              <div className="flow__step-icon">{step.icon}</div>
              <div className="flow__step-name">{step.name}</div>
              <p className="flow__step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   TRY CHECKOUT / PHONE MOCKUP
═══════════════════════════════════════════════════════ */
function PhoneMockup() {
  return (
    <div className="phone-mockup">
      <div className="phone-mockup__notch" />
      <div className="phone-mockup__avatar">DS</div>
      <div className="phone-mockup__store-name">Demo Store</div>
      <div className="phone-mockup__cta-text">Complete your purchase</div>
      {[
        { label: 'Amount',     val: <><span className="phone-mockup__amount">$49.99</span></> },
        { label: 'Network',    val: <><span className="network-dot" /> Base</> },
        { label: 'Paying with',val: <><TokenLogo symbol="USDC" size={14} /> USDC</> },
      ].map(r => (
        <div key={r.label} className="phone-mockup__row">
          <span className="phone-mockup__row-label">{r.label}</span>
          <span className="phone-mockup__row-val">{r.val}</span>
        </div>
      ))}
      <div className="phone-mockup__paid">
        <div className="phone-mockup__paid-icon">✓</div>
        <div className="phone-mockup__paid-label">PAID</div>
        <div className="phone-mockup__paid-sub">Payment confirmed</div>
      </div>
    </div>
  );
}

function TryCheckout() {
  return (
    <section className="try-checkout">
      <div className="try-checkout__inner">
        <div className="section-header">
          <h2 className="section-header__title">Try the Checkout</h2>
          <p className="section-header__sub">Experience our checkout flow firsthand.</p>
          <div className="section-header__divider" />
        </div>
        <div className="try-checkout__grid">
          <div>
            <h3 className="try-checkout__left-title">Two Ways to Pay</h3>
            <p className="try-checkout__left-sub">Every checkout supports two payment modes.</p>
            {[
              { icon: 'W', name: 'External Wallet', desc: 'Connect MetaMask, Phantom, or any of 300+ wallets. Sign a gasless message.' },
              { icon: '+', name: 'One Time Wallet',  desc: 'Temporary wallet generated in-browser. Keys never leave the device.' },
            ].map(o => (
              <div key={o.name} className="pay-option">
                <div className="pay-option__header">
                  <div className="pay-option__icon">{o.icon}</div>
                  <div className="pay-option__name">{o.name}</div>
                </div>
                <p className="pay-option__desc">{o.desc}</p>
              </div>
            ))}
          </div>
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   IN-PERSON
═══════════════════════════════════════════════════════ */
function PosPhone() {
  const keys = ['1','2','3','4','5','6','7','8','9','.','0','<'];
  return (
    <div className="pos-phone">
      <div className="pos-phone__notch" />
      <div className="pos-phone__amount"><span className="pos-phone__amount-val"><sup className="pos-phone__amount-sup">$</sup>42.50</span></div>
      <button className="pos-phone__continue">Continue</button>
      <div className="pos-phone__keypad">{keys.map(k=><div key={k} className="pos-phone__key">{k}</div>)}</div>
    </div>
  );
}

function InPerson() {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const features = [
    { icon: 'QR', name: 'QR Checkout',        desc: 'Customer scans, selects chain, pays instantly' },
    { icon: '~',  name: 'Live Updates',        desc: 'Real-time payment confirmations' },
    { icon: 'H',  name: 'Transaction History', desc: 'Full history with receipts' },
    { icon: 'M',  name: 'Any Device',          desc: 'Phone, tablet, or desktop' },
  ];
  return (
    <section className="in-person">
      <div className="in-person__inner">
        <div>
          <div className="in-person__badge">In-Person Payments</div>
          <h2 className="in-person__title">Accept crypto <br /><span>at your counter</span></h2>
          <p className="in-person__sub">Turn any device into a crypto payment terminal. QR-based checkout, zero hardware required.</p>
          <div className="in-person__features">
            {features.map(f=>(
              <div key={f.name} className="in-person__feature">
                <div className="in-person__feature-icon">{f.icon}</div>
                <div>
                  <div className="in-person__feature-name">{f.name}</div>
                  <div className="in-person__feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-outline-white" onClick={() => scrollTo('converter')}>
            Try it now →
          </button>
        </div>
        <PosPhone />
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   DEVELOPERS
═══════════════════════════════════════════════════════ */
const CODE_TABS = {
  'REST API': [
    { n:1,  t: <><span className="ck">import</span> {'{ '}<span className="cf">Stbl</span>{' }'} <span className="ck">from</span> <span className="cs">'@stbl/sdk'</span>;</> },
    { n:2,  t: <> </> },
    { n:3,  t: <><span className="ck">const</span> <span className="cp">stbl</span> = <span className="ck">new</span> <span className="cf">Stbl</span>(process.env.<span className="cp">STBL_SECRET_KEY</span>);</> },
    { n:4,  t: <> </> },
    { n:5,  t: <><span className="ck">const</span> <span className="cp">session</span> = <span className="ck">await</span> stbl.sessions.<span className="cf">create</span>({'({'}</> },
    { n:6,  t: <>&nbsp;&nbsp;<span className="cp">amount</span>: <span className="cn">49.99</span>,</> },
    { n:7,  t: <>&nbsp;&nbsp;<span className="cp">currency</span>: <span className="cs">'USD'</span>,</> },
    { n:8,  t: <>&nbsp;&nbsp;<span className="cp">metadata</span>: {'{ '}<span className="cp">order_id</span>: <span className="cs">'12345'</span>{' }'}</> },
    { n:9,  t: <>{'});'}</> },
    { n:10, t: <> </> },
    { n:11, t: <><span className="cc">{'// Redirect to hosted checkout'}</span></> },
    { n:12, t: <><span className="ck">return</span> session.<span className="cp">url</span>;</> },
  ],
  'Shopify': [
    { n:1, t: <><span className="cc">{`<!-- In your theme.liquid -->`}</span></> },
    { n:2, t: <></> },
    { n:3, t: <><span className="ck">{'<script'}</span> <span className="cp">src</span>=<span className="cs">"https://cdn.stbl.io/shopify.js"</span><span className="ck">></span></> },
    { n:4, t: <><span className="ck">{'</script>'}</span></> },
    { n:5, t: <></> },
    { n:6, t: <><span className="cc">{'// Configure via Shopify admin panel'}</span></> },
    { n:7, t: <><span className="cc">{'// Apps → STBL → Connect wallet'}</span></> },
  ],
  'WooCommerce': [
    { n:1, t: <><span className="cc">{'// Install WooCommerce plugin'}</span></> },
    { n:2, t: <><span className="cc">{'// wp-content/plugins/stbl-woo/'}</span></> },
    { n:3, t: <></> },
    { n:4, t: <><span className="ck">add_filter</span>(<span className="cs">'woocommerce_payment_gateways'</span>,</> },
    { n:5, t: <>&nbsp;&nbsp;<span className="ck">function</span>(<span className="cp">$gateways</span>) {'{'}</> },
    { n:6, t: <>&nbsp;&nbsp;&nbsp;&nbsp;<span className="cp">$gateways</span>[] = <span className="cs">'WC_STBL_Gateway'</span>;</> },
    { n:7, t: <>&nbsp;&nbsp;&nbsp;&nbsp;<span className="ck">return</span> <span className="cp">$gateways</span>;</> },
    { n:8, t: <>&nbsp;&nbsp;{'}'}</> },
    { n:9, t: <>);</> },
  ],
};

const TAB_LINKS = {
  'REST API':    'https://docs.stbl.io',
  'Shopify':     'https://apps.shopify.com',
  'WooCommerce': 'https://woocommerce.com/products',
};

function Developers() {
  const [tab, setTab] = useState('REST API');
  return (
    <section className="developers" id="developers">
      <div className="developers__inner">
        <div>
          <h2 className="developers__title">Built for developers</h2>
          <p className="developers__sub">Powerful SDKs, comprehensive API, and webhooks. Accept any stablecoin with just a few lines of code.</p>
          <div className="developers__divider" />
          <div className="dev-tabs">
            {Object.keys(CODE_TABS).map(t => (
              <button key={t} className={`dev-tab${tab===t?' dev-tab--active':''}`} onClick={() => setTab(t)}>
                {t === 'REST API' ? '</> REST API' : t}
              </button>
            ))}
          </div>
          <div className="dev-features">
            {[
              { l:'N', t:'Non-custodial — no funds held by us' },
              { l:'C', t:'Native Multi-chain: Base, Solana, Polygon' },
              { l:'F', t:'Fiat pricing with real-time conversion' },
            ].map(f => (
              <div key={f.t} className="dev-feature">
                <div className="dev-feature__icon">{f.l}</div>{f.t}
              </div>
            ))}
          </div>
          <button className="dev-docs-btn" onClick={() => window.open(TAB_LINKS[tab], '_blank')}>
            View {tab} docs →
          </button>
        </div>
        <div className="code-block">
          <div className="code-block__header">
            <div className="code-block__dots">
              <span className="code-block__dot d1" />
              <span className="code-block__dot d2" />
              <span className="code-block__dot d3" />
            </div>
            <span className="code-block__filename">{tab === 'REST API' ? 'checkout.ts' : tab === 'Shopify' ? 'theme.liquid' : 'functions.php'}</span>
          </div>
          <div className="code-block__body">
            {CODE_TABS[tab].map((line, i) => (
              <div key={i} className="code-line">
                <span className="code-line__num">{line.n}</span>
                <span className="code-line__text">{line.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   COMPATIBILITY
═══════════════════════════════════════════════════════ */
function Compat() {
  const platforms = [
    { name: 'Shopify',      url: 'https://apps.shopify.com' },
    { name: 'WooCommerce',  url: 'https://woocommerce.com/products' },
    { name: 'Custom API',   url: 'https://docs.stbl.io' },
  ];
  return (
    <div className="compat">
      <div className="compat__label">Universal Compatibility</div>
      <div className="compat__logos">
        {platforms.map(p => (
          <a key={p.name} className="compat__logo" href={p.url} target="_blank" rel="noopener noreferrer">
            {p.name}
          </a>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PRICING
═══════════════════════════════════════════════════════ */
function Pricing() {
  const handleJoin = () => window.open('mailto:hello@stbl.io?subject=Early Access Request&body=I would like to join STBL early access.', '_blank');
  return (
    <section className="pricing" id="pricing">
      <div className="pricing__inner">
        <div className="section-header">
          <h2 className="section-header__title">Simple, transparent pricing</h2>
          <p className="section-header__sub">No hidden fees. No monthly minimums. No contract lock-ins.</p>
          <div className="section-header__divider" />
        </div>
        <div className="pricing__card">
          <div className="pricing__early-badge">Beta Early Access</div>
          <div className="pricing__card-top">
            <div>
              <div className="pricing__plan-name">STBL Beta</div>
              <div className="pricing__plan-sub">Free payment infrastructure for early partners</div>
            </div>
            <div className="pricing__percentage">0% <span>fees</span></div>
          </div>
          <div className="pricing__features-grid">
            <div>
              <div className="pricing__features-col-label">Included</div>
              {['Unlimited transactions','All supported networks','Webhooks and API access','Real-time Chainlink oracles'].map(f=>(
                <div key={f} className="pricing__feature-item"><span className="pricing__check">✓</span> {f}</div>
              ))}
            </div>
            <div>
              <div className="pricing__features-col-label">Beta Benefits</div>
              {['Priority engineering support','Custom feature requests','Direct Slack access','Early access to new chains'].map(b=>(
                <div key={b} className="pricing__feature-item"><span className="pricing__check">✓</span> {b}</div>
              ))}
            </div>
          </div>
          <button className="btn-join" onClick={handleJoin}>Join early access →</button>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   CTA BANNER
═══════════════════════════════════════════════════════ */
const BSTARS = Array.from({length:14},(_,i)=>({id:i,top:`${10+Math.random()*80}%`,left:`${5+Math.random()*90}%`}));

function CtaBanner() {
  const handleJoin = () => window.open('mailto:hello@stbl.io?subject=Early Access Request&body=I would like to join STBL early access.', '_blank');
  return (
    <section className="cta-banner">
      <div className="cta-banner__card">
        {BSTARS.map(s=><div key={s.id} className="cta-banner__star" style={{top:s.top,left:s.left}}/>)}
        <h2 className="cta-banner__title">Start accepting crypto payments today</h2>
        <p className="cta-banner__sub">Join forward-thinking businesses leveraging stablecoins for faster settlements, 0% fees, and global reach.</p>
        <button className="btn-join-cta" onClick={handleJoin}>Join →</button>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   FOOTER
═══════════════════════════════════════════════════════ */
function Footer() {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div>
          <div className="footer__brand-logo"><div className="footer__brand-sphere"/>STBL</div>
          <p className="footer__brand-desc">The non-custodial payment gateway for the next generation of online commerce.</p>
        </div>
        <div>
          <div className="footer__col-title">Product</div>
          <button className="footer__link" onClick={() => scrollTo('how-it-works')}>How it works</button>
          <button className="footer__link" onClick={() => scrollTo('converter')}>Converter</button>
          <button className="footer__link" onClick={() => scrollTo('developers')}>Developers</button>
          <button className="footer__link" onClick={() => scrollTo('pricing')}>Pricing</button>
        </div>
        <div>
          <div className="footer__col-title">Resources</div>
          <a className="footer__link" href="https://solscan.io" target="_blank" rel="noopener noreferrer">Solscan</a>
          <a className="footer__link" href="https://jup.ag" target="_blank" rel="noopener noreferrer">Jupiter</a>
          <a className="footer__link" href="https://phantom.app" target="_blank" rel="noopener noreferrer">Phantom</a>
          <a className="footer__link" href="https://basescan.org" target="_blank" rel="noopener noreferrer">Basescan</a>
        </div>
        <div>
          <div className="footer__col-title">Chains</div>
          <a className="footer__link" href="https://base.org" target="_blank" rel="noopener noreferrer">Base</a>
          <a className="footer__link" href="https://solana.com" target="_blank" rel="noopener noreferrer">Solana</a>
          <a className="footer__link" href="https://polygon.technology" target="_blank" rel="noopener noreferrer">Polygon</a>
          <a className="footer__link" href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer">CoinGecko</a>
        </div>
      </div>
      <div className="footer__bottom">
        <span className="footer__copy">© {new Date().getFullYear()} STBL. All rights reserved.</span>
        <span className="footer__copy">Powered by Jupiter · Phantom · CoinGecko</span>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════
   APP ROOT
═══════════════════════════════════════════════════════ */
export default function App() {
  return (
    <>
      <GlobalStarField />
      <Navbar />
      <PriceTicker />
      <CABar />
      <main>
        <Hero />
        <StatsBar />
        <GlobalLiquidity />
        <CheckoutFlow />
        <CryptoConverter />
        <TryCheckout />
        <InPerson />
        <Developers />
        <Compat />
        <Pricing />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}