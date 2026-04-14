'use client';

import styles from './ChatMessages.module.css';
import { useState, useRef } from 'react';
import { Sparkles, ExternalLink, Loader2, AlertCircle, CheckCircle, Star, ShoppingCart, Plane, Wallet, QrCode, XCircle, BarChart3 } from 'lucide-react';

// Clean markdown symbols from AI responses for visual display
const cleanMarkdown = (text) => {
    return text
        .replace(/\*\*/g, '')  // Remove bold **
        .replace(/\*/g, '')    // Remove italic *
        .replace(/`/g, '')     // Remove code backticks
        .replace(/#+\s?/g, '') // Remove headers #
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Convert links to text
};

// Render transaction result badge
function TxResultBadge({ message }) {
    if (message.pending) {
        const labels = {
            swap: 'Processing swap',
            send: 'Sending SOL',
            stake: 'Staking',
            unstake: 'Unstaking',
            portfolio: 'Loading portfolio',
            history: 'Loading history',
            price: 'Fetching price',
            amazon: 'Searching Amazon',
            limit_order: 'Creating limit order',
        };
        return (
            <div className={styles.actionBadge} data-status="pending">
                <Loader2 size={14} className={styles.spinner} />
                <span>{labels[message.pendingType] || 'Processing'}...</span>
            </div>
        );
    }

    if (message.actionError) {
        return (
            <div className={styles.actionBadge} data-status="error">
                <AlertCircle size={14} />
                <span>{message.actionError}</span>
            </div>
        );
    }

    if (message.txSignature) {
        const labels = { swap: 'Swap confirmed', send: 'Transfer confirmed', stake: 'Staked', unstake: 'Unstaked', limit_order: 'Limit order created' };
        return (
            <div className={styles.actionBadge} data-status="success">
                <CheckCircle size={14} />
                <span>{labels[message.txType] || 'Transaction confirmed'}</span>
                <a
                    href={`https://solscan.io/tx/${message.txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.txLink}
                >
                    View <ExternalLink size={12} />
                </a>
            </div>
        );
    }

    return null;
}

// Render price data
function PriceDisplay({ data }) {
    if (!data || !data.price) return null;
    const price = Number(data.price);
    const formatPrice = (p) => {
        if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
        if (p >= 1) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
        if (p >= 0.01) return p.toLocaleString(undefined, { maximumFractionDigits: 4 });
        if (p >= 0.0001) return p.toLocaleString(undefined, { maximumFractionDigits: 6 });
        return p.toLocaleString(undefined, { maximumFractionDigits: 9 });
    };
    return (
        <div className={styles.priceCard}>
            <div className={styles.priceHeader}>
                <span className={styles.priceTokenName}>{data.tokenName || data.symbol || 'Token'}</span>
                {data.symbol && <span className={styles.priceSymbol}>{data.symbol}</span>}
            </div>
            <div className={styles.priceValue}>${formatPrice(price)}</div>
            {data.marketCap && (
                <div className={styles.priceMeta}>MCap: ${Number(data.marketCap).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            )}
        </div>
    );
}

// Render portfolio assets
function PortfolioDisplay({ assets }) {
    if (!assets || assets.length === 0) return <div className={styles.priceMeta}>No tokens found.</div>;
    return (
        <div className={styles.portfolioGrid}>
            {assets.slice(0, 10).map((a, i) => (
                <div key={i} className={styles.portfolioItem}>
                    {a.icon && <img src={a.icon} alt="" className={styles.tokenIcon} />}
                    <div className={styles.tokenInfo}>
                        <span className={styles.tokenSymbol}>{a.symbol || 'Unknown'}</span>
                        <span className={styles.tokenAmount}>{Number(a.amount).toFixed(4)}</span>
                    </div>
                    {a.usdValue > 0 && <span className={styles.tokenUsd}>${a.usdValue.toFixed(2)}</span>}
                </div>
            ))}
        </div>
    );
}

// Render Amazon products
function AmazonDisplay({ products }) {
    if (!products || products.length === 0) return <div className={styles.priceMeta}>No products found.</div>;
    return (
        <div className={styles.amazonGrid}>
            {products.slice(0, 4).map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className={styles.amazonCard}>
                    {p.image && <img src={p.image} alt="" className={styles.amazonImage} />}
                    <div className={styles.amazonInfo}>
                        <span className={styles.amazonTitle}>{p.title?.slice(0, 60)}{p.title?.length > 60 ? '...' : ''}</span>
                        <div className={styles.amazonMeta}>
                            <span className={styles.amazonPrice}>${p.price}</span>
                            {p.rating && (
                                <span className={styles.amazonRating}>
                                    <Star size={11} fill="#f59e0b" stroke="#f59e0b" /> {p.rating}
                                </span>
                            )}
                        </div>
                    </div>
                </a>
            ))}
        </div>
    );
}

/* ─── Flight Search Form Inline Component (real AeroDataBox API + USDC, light theme) ─── */
function FlightSearchFormInline({ chatId, saveMessageToChat, wallet }) {
  const [step, setStep] = useState('form');
  const [form, setForm] = useState({
    from: '', to: '', fromIata: '', toIata: '', departureDate: '', returnDate: '',
    tripType: 'roundtrip', passengers: '1', travelClass: 'economy',
  });
  const [results, setResults] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentData, setPaymentData] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [searchProgress, setSearchProgress] = useState(0);
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [showFromDrop, setShowFromDrop] = useState(false);
  const [showToDrop, setShowToDrop] = useState(false);
  const fromRef = useRef(null);
  const toRef = useRef(null);
  const MERCHANT_WALLET = 'CsQckUWvnEBURG7h2KzScdCzQp4N879SyDhJ9dbymLFs';

  const today = new Date().toISOString().split('T')[0];
  const accentColor = '#0078D2';
  const usdcBalance = wallet?.usdcBalance ?? null;

  const inputStyle = { width: '100%', padding: '10px 12px', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: '8px', color: '#111827', fontSize: '13px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '11px', color: '#6B7280', fontWeight: 600, marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.3px' };
  const selectStyle = { ...inputStyle, appearance: 'none', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' fill=\'%236B7280\' viewBox=\'0 0 16 16\'%3E%3Cpath d=\'M8 11L3 6h10z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' };

  // Airport autocomplete search
  const searchAirports = async (query, setter, showSetter) => {
    if (!query || query.length < 2) { setter([]); showSetter(false); return; }
    try {
      const resp = await fetch('/api/flights/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'airport_search', query }),
      });
      const data = await resp.json();
      if (data.success && data.airports?.length) { setter(data.airports); showSetter(true); }
      else { setter([]); showSetter(false); }
    } catch { setter([]); showSetter(false); }
  };

  const fromTimer = useRef(null);
  const toTimer = useRef(null);
  const handleFromChange = (val) => {
    setForm(f => ({ ...f, from: val, fromIata: '' }));
    clearTimeout(fromTimer.current);
    fromTimer.current = setTimeout(() => searchAirports(val, setFromSuggestions, setShowFromDrop), 350);
  };
  const handleToChange = (val) => {
    setForm(f => ({ ...f, to: val, toIata: '' }));
    clearTimeout(toTimer.current);
    toTimer.current = setTimeout(() => searchAirports(val, setToSuggestions, setShowToDrop), 350);
  };

  const selectFromAirport = (apt) => {
    setForm(f => ({ ...f, from: `${apt.city || apt.name} (${apt.iata})`, fromIata: apt.iata }));
    setShowFromDrop(false);
  };
  const selectToAirport = (apt) => {
    setForm(f => ({ ...f, to: `${apt.city || apt.name} (${apt.iata})`, toIata: apt.iata }));
    setShowToDrop(false);
  };

  // Real flight search via AeroDataBox API
  const handleSearch = async () => {
    const fromCode = form.fromIata || form.from.match(/\(([A-Z]{3})\)/)?.[1] || form.from.trim().toUpperCase();
    const toCode = form.toIata || form.to.match(/\(([A-Z]{3})\)/)?.[1] || form.to.trim().toUpperCase();
    if (!fromCode || !toCode || !form.departureDate) return;
    setStep('searching');
    setSearchProgress(0);

    const progressInterval = setInterval(() => {
      setSearchProgress(p => Math.min(p + 8, 85));
    }, 400);

    try {
      const resp = await fetch('/api/flights/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'flight_search',
          from: fromCode, to: toCode,
          date: form.departureDate,
          passengers: form.passengers,
          travelClass: form.travelClass,
        }),
      });
      clearInterval(progressInterval);
      setSearchProgress(100);
      const data = await resp.json();

      if (!resp.ok) throw new Error(data.error || 'Flight search failed');
      if (!data.flights?.length) {
        setResults([]);
        setErrorMsg(`No direct flights found from ${fromCode} to ${toCode} on ${form.departureDate}. Try a different date or route.`);
        setStep('error');
        return;
      }

      const flights = data.flights.map(f => ({
        ...f,
        returnDate: form.tripType === 'roundtrip' ? form.returnDate : null,
      }));
      setResults(flights);
      setStep('results');
    } catch (err) {
      clearInterval(progressInterval);
      setErrorMsg(err.message || 'Failed to search flights');
      setStep('error');
    }
  };

  const handleSelectFlight = (flight) => { setSelectedFlight(flight); setStep('checkout'); };

  const handlePayWithWallet = async () => {
    if (!wallet?.sendUSDC || !wallet?.publicKey) { setErrorMsg('Wallet not connected'); setStep('error'); return; }
    setStep('paying');
    try {
      const result = await wallet.sendUSDC(MERCHANT_WALLET, selectedFlight.price);
      if (result.success) {
        setPaymentData({ signature: result.signature, amount: selectedFlight.price });
        setPaymentMethod('wallet');
        setStep('payment');
        if (chatId && saveMessageToChat) {
          saveMessageToChat(chatId, {
            id: Date.now() + 2000, type: 'ai',
            content: `Flight booked successfully!\n\n${selectedFlight.airline} — ${selectedFlight.flightNumber}\nRoute: ${selectedFlight.from} → ${selectedFlight.to}\nDate: ${selectedFlight.date}\nClass: ${selectedFlight.travelClass.charAt(0).toUpperCase() + selectedFlight.travelClass.slice(1)}\nPassengers: ${selectedFlight.passengers}\nAmount paid: ${selectedFlight.price.toFixed(2)} USDC\n\nYour e-ticket and confirmation will be sent to your email. Have a great flight!`,
            pending: false,
          });
        }
        if (wallet.refreshBalance) setTimeout(() => wallet.refreshBalance(), 1500);
      }
    } catch (err) { setErrorMsg(err.message); setStep('error'); }
  };

  const handleGenerateQR = async () => {
    setPaymentMethod('qr');
    setStep('generating');
    try {
      const resp = await fetch('/api/solana-pay/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: selectedFlight.price, product: { title: `${selectedFlight.airline} ${selectedFlight.flightNumber} — ${selectedFlight.from} to ${selectedFlight.to}`, price: selectedFlight.price } }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to generate payment');
      setPaymentData(data);
      setStep('payment');
    } catch (err) { setErrorMsg(err.message); setStep('error'); }
  };

  const stopsLabel = (s) => s === 0 ? 'Nonstop' : s === 1 ? '1 stop' : `${s} stops`;
  const stopsColor = (s) => s === 0 ? '#16a34a' : s === 1 ? '#d97706' : '#dc2626';

  const dropdownStyle = { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: '8px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' };
  const dropItemStyle = { padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.06)', transition: 'background 0.15s' };

  return (
    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0,120,210,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Plane size={18} color={accentColor} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>
            {step === 'form' ? 'Search Flights' : step === 'searching' ? 'Searching Flights...' : step === 'results' ? `${results.length} Flights Found` : step === 'checkout' ? 'Confirm & Pay' : step === 'payment' ? 'Booking Confirmed' : 'Flight Booking'}
          </p>
          <p style={{ margin: 0, fontSize: '11px', color: '#6B7280' }}>
            {step === 'form' ? 'Real-time flight data • Pay with USDC' : step === 'searching' ? 'Checking real airline schedules...' : step === 'results' ? `${form.fromIata || form.from} → ${form.toIata || form.to} • ${form.departureDate}` : step === 'checkout' ? selectedFlight?.airline : step === 'payment' ? 'Transaction confirmed' : ''}
          </p>
        </div>
      </div>

      {/* STEP: Form */}
      {step === 'form' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', background: '#F9FAFB', borderRadius: '8px', padding: '4px', border: '1px solid rgba(0,0,0,0.06)' }}>
            {['roundtrip', 'oneway'].map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, tripType: t }))}
                style={{ flex: 1, padding: '7px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  background: form.tripType === t ? 'rgba(0,120,210,0.1)' : 'transparent',
                  color: form.tripType === t ? accentColor : '#6B7280' }}>
                {t === 'roundtrip' ? 'Round Trip' : 'One Way'}
              </button>
            ))}
          </div>
          {/* From / To with autocomplete */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, position: 'relative' }} ref={fromRef}>
              <label style={labelStyle}>From</label>
              <input placeholder="City or airport code" value={form.from} onChange={e => handleFromChange(e.target.value)}
                onFocus={() => { if (fromSuggestions.length) setShowFromDrop(true); }}
                style={{ ...inputStyle, borderColor: form.fromIata ? 'rgba(22,163,74,0.4)' : undefined }}
                onBlur={() => setTimeout(() => setShowFromDrop(false), 200)} />
              {form.fromIata && <span style={{ position: 'absolute', right: '10px', top: '28px', fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>{form.fromIata}</span>}
              {showFromDrop && fromSuggestions.length > 0 && (
                <div style={dropdownStyle}>
                  {fromSuggestions.map((apt, i) => (
                    <div key={apt.iata + i} onClick={() => selectFromAirport(apt)}
                      style={dropItemStyle}
                      onMouseOver={e => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#111827' }}>{apt.city || apt.name} <span style={{ color: accentColor }}>({apt.iata})</span></p>
                      <p style={{ margin: 0, fontSize: '10px', color: '#6B7280' }}>{apt.name}{apt.country ? ` • ${apt.country}` : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: 1, position: 'relative' }} ref={toRef}>
              <label style={labelStyle}>To</label>
              <input placeholder="City or airport code" value={form.to} onChange={e => handleToChange(e.target.value)}
                onFocus={() => { if (toSuggestions.length) setShowToDrop(true); }}
                style={{ ...inputStyle, borderColor: form.toIata ? 'rgba(22,163,74,0.4)' : undefined }}
                onBlur={() => setTimeout(() => setShowToDrop(false), 200)} />
              {form.toIata && <span style={{ position: 'absolute', right: '10px', top: '28px', fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>{form.toIata}</span>}
              {showToDrop && toSuggestions.length > 0 && (
                <div style={dropdownStyle}>
                  {toSuggestions.map((apt, i) => (
                    <div key={apt.iata + i} onClick={() => selectToAirport(apt)}
                      style={dropItemStyle}
                      onMouseOver={e => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#111827' }}>{apt.city || apt.name} <span style={{ color: accentColor }}>({apt.iata})</span></p>
                      <p style={{ margin: 0, fontSize: '10px', color: '#6B7280' }}>{apt.name}{apt.country ? ` • ${apt.country}` : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Departure</label>
              <input type="date" min={today} value={form.departureDate} onChange={e => setForm(f => ({ ...f, departureDate: e.target.value }))} style={inputStyle} />
            </div>
            {form.tripType === 'roundtrip' && (
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Return</label>
                <input type="date" min={form.departureDate || today} value={form.returnDate} onChange={e => setForm(f => ({ ...f, returnDate: e.target.value }))} style={inputStyle} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Passengers</label>
              <select value={form.passengers} onChange={e => setForm(f => ({ ...f, passengers: e.target.value }))} style={selectStyle}>
                {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n} {n === 1 ? 'passenger' : 'passengers'}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Class</label>
              <select value={form.travelClass} onChange={e => setForm(f => ({ ...f, travelClass: e.target.value }))} style={selectStyle}>
                <option value="economy">Economy</option>
                <option value="business">Business</option>
                <option value="first">First Class</option>
              </select>
            </div>
          </div>
          <button onClick={handleSearch}
            disabled={!form.from.trim() || !form.to.trim() || !form.departureDate || (form.tripType === 'roundtrip' && !form.returnDate)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              background: (!form.from.trim() || !form.to.trim() || !form.departureDate) ? '#F3F4F6' : 'rgba(0,120,210,0.1)',
              color: (!form.from.trim() || !form.to.trim() || !form.departureDate) ? '#9CA3AF' : accentColor }}
            onMouseOver={e => { if (form.from.trim() && form.to.trim() && form.departureDate) e.currentTarget.style.background = 'rgba(0,120,210,0.15)'; }}
            onMouseOut={e => { if (form.from.trim() && form.to.trim() && form.departureDate) e.currentTarget.style.background = 'rgba(0,120,210,0.1)'; }}>
            <Plane size={14} /> Search Flights
          </button>
        </div>
      )}

      {/* STEP: Searching */}
      {step === 'searching' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: accentColor }} />
            <p style={{ margin: 0, fontSize: '13px', color: '#111827', fontWeight: 500 }}>
              {searchProgress < 30 ? 'Querying airline schedules...' : searchProgress < 60 ? 'Fetching real-time departures...' : searchProgress < 90 ? 'Calculating prices...' : 'Almost done!'}
            </p>
          </div>
          <div style={{ height: '4px', background: '#F3F4F6', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${searchProgress}%`, height: '100%', background: `linear-gradient(90deg, ${accentColor}, #3B82F6)`, borderRadius: '2px', transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6B7280' }}>
            <span>{form.fromIata || form.from} → {form.toIata || form.to}</span>
            <span>{searchProgress}%</span>
          </div>
        </div>
      )}

      {/* STEP: Results */}
      {step === 'results' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
            <span style={{ fontSize: '11px', color: '#6B7280' }}>{form.tripType === 'roundtrip' ? 'Round trip' : 'One way'} • {form.passengers} pax • {form.travelClass.charAt(0).toUpperCase() + form.travelClass.slice(1)}</span>
            <button onClick={() => { setStep('form'); setErrorMsg(''); }} style={{ background: 'none', border: 'none', color: accentColor, fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Edit search</button>
          </div>
          {results.map((fl) => (
            <div key={fl.id} onClick={() => handleSelectFlight(fl)}
              style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,120,210,0.1)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: fl.airlineColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff' }}>{fl.airlineCode}</div>
                  <div>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#111827' }}>{fl.airline}</p>
                    <p style={{ margin: 0, fontSize: '10px', color: '#6B7280' }}>{fl.flightNumber}{fl.aircraft ? ` • ${fl.aircraft}` : ''}</p>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>${fl.price.toFixed(0)} <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280' }}>USDC</span></p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{fl.departureTime}</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span style={{ fontSize: '10px', color: '#6B7280' }}>{fl.duration}</span>
                  <div style={{ width: '100%', height: '1px', background: 'rgba(0,0,0,0.1)', position: 'relative' }}>
                    {fl.stops > 0 && Array.from({ length: fl.stops }).map((_, si) => (
                      <div key={si} style={{ position: 'absolute', top: '-2px', left: `${((si + 1) / (fl.stops + 1)) * 100}%`, width: '5px', height: '5px', borderRadius: '50%', background: stopsColor(fl.stops) }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '10px', color: stopsColor(fl.stops), fontWeight: 500 }}>{stopsLabel(fl.stops)}</span>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{fl.arrivalTime}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STEP: Checkout */}
      {step === 'checkout' && selectedFlight && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ padding: '14px', background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: selectedFlight.airlineColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff' }}>{selectedFlight.airlineCode}</div>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#111827' }}>{selectedFlight.airline}</p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#6B7280' }}>{selectedFlight.flightNumber} • {selectedFlight.travelClass.charAt(0).toUpperCase() + selectedFlight.travelClass.slice(1)}{selectedFlight.aircraft ? ` • ${selectedFlight.aircraft}` : ''}</p>
                </div>
              </div>
              <button onClick={() => setStep('results')} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '11px', cursor: 'pointer', padding: 0 }}>Change</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>{selectedFlight.departureTime}</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#6B7280', fontWeight: 500 }}>{selectedFlight.from}</p>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '10px', color: '#6B7280' }}>{selectedFlight.duration}</p>
                <div style={{ height: '1px', background: 'rgba(0,0,0,0.1)', margin: '4px 0' }} />
                <p style={{ margin: 0, fontSize: '10px', color: stopsColor(selectedFlight.stops), fontWeight: 500 }}>{stopsLabel(selectedFlight.stops)}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>{selectedFlight.arrivalTime}</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#6B7280', fontWeight: 500 }}>{selectedFlight.to}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#6B7280', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '8px' }}>
              <span>{selectedFlight.date}</span>
              {selectedFlight.returnDate && <span>Return: {selectedFlight.returnDate}</span>}
              <span>{selectedFlight.passengers} pax</span>
            </div>
          </div>

          <div style={{ padding: '12px', background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>Total Price</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>${selectedFlight.price.toFixed(2)} <span style={{ fontSize: '12px', fontWeight: 500 }}>USDC</span></span>
            </div>
            {usdcBalance !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <span style={{ fontSize: '11px', color: '#6B7280' }}>Your USDC balance</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: usdcBalance >= selectedFlight.price ? '#6B7280' : '#dc2626' }}>{usdcBalance.toFixed(2)} USDC</span>
              </div>
            )}
            {usdcBalance !== null && usdcBalance < selectedFlight.price && (
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#dc2626' }}>Insufficient USDC balance. You need {(selectedFlight.price - usdcBalance).toFixed(2)} more USDC.</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {usdcBalance !== null && usdcBalance >= selectedFlight.price && (
              <button onClick={handlePayWithWallet}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', border: '1px solid rgba(0,120,210,0.3)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', background: 'rgba(0,120,210,0.08)', color: accentColor }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(0,120,210,0.15)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(0,120,210,0.08)'}>
                <Wallet size={14} /> Pay ${selectedFlight.price.toFixed(2)} USDC
              </button>
            )}
            <button onClick={handleGenerateQR}
              style={{ flex: usdcBalance !== null && usdcBalance >= selectedFlight.price ? undefined : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px 16px', background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: '#6B7280', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={e => e.currentTarget.style.background = '#F3F4F6'}
              onMouseOut={e => e.currentTarget.style.background = '#F9FAFB'}>
              <QrCode size={14} /> {usdcBalance !== null && usdcBalance >= selectedFlight.price ? '' : 'Generate Payment QR'}
            </button>
          </div>
        </div>
      )}

      {/* STEP: Paying / Generating */}
      {(step === 'paying' || step === 'generating') && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px 0' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: accentColor }} />
          <p style={{ margin: 0, fontSize: '13px', color: '#111827', fontWeight: 500 }}>{step === 'paying' ? 'Processing USDC payment...' : 'Generating Solana Pay QR...'}</p>
          {step === 'paying' && <p style={{ margin: 0, fontSize: '11px', color: '#6B7280' }}>Confirm the transaction in your wallet</p>}
        </div>
      )}

      {/* STEP: Payment Success */}
      {step === 'payment' && paymentData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {paymentMethod === 'wallet' && paymentData.signature && (
            <>
              <div style={{ padding: '16px', background: '#F0FDF4', border: '1px solid rgba(22,163,74,0.2)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><CheckCircle size={40} color="#16a34a" /></div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>Booking Confirmed!</p>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#6B7280' }}>{selectedFlight?.airline} • {selectedFlight?.from} → {selectedFlight?.to}</p>
              </div>
              <div style={{ padding: '12px', background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>Amount Paid</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>${paymentData.amount.toFixed(2)} USDC</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500 }}>Transaction ID</span>
                  <span style={{ fontSize: '10px', color: '#374151', fontFamily: 'monospace', wordBreak: 'break-all' }}>{paymentData.signature}</span>
                </div>
              </div>
            </>
          )}
          {paymentMethod === 'qr' && paymentData.qrCode && (
            <>
              <div style={{ padding: '12px', background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>Total</span>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>${selectedFlight?.price.toFixed(2)} USDC</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><QrCode size={16} color="#6B7280" /><span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>Scan to Pay</span></div>
                <div style={{ width: '140px', height: '140px', background: '#fff', borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <div dangerouslySetInnerHTML={{ __html: paymentData.qrCode }} style={{ maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: '#6B7280', textAlign: 'center' }}>Scan with a Solana wallet to pay</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP: Error */}
      {step === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px' }}>
            <XCircle size={18} color="#dc2626" />
            <span style={{ color: '#dc2626', fontSize: '13px', fontWeight: 500 }}>{selectedFlight ? 'Payment Failed' : 'Search Error'}</span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#374151', wordBreak: 'break-word', padding: '12px', background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '8px' }}>{errorMsg}</p>
          <button onClick={() => { setStep(selectedFlight ? 'checkout' : 'form'); setErrorMsg(''); }}
            style={{ background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', padding: '10px', fontSize: '13px', color: '#111827', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseOver={e => e.currentTarget.style.background = '#F3F4F6'}
            onMouseOut={e => e.currentTarget.style.background = '#F9FAFB'}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Prediction Market Data ─── */
const PREDICTION_MARKETS = [
  { id: 'pm-1', question: 'Will Bitcoin hit $120K by July 2026?', category: 'Crypto', yesPercent: 62, totalVoters: 14823, volume: '$2.4M', endsAt: 'Jul 31, 2026', icon: 'BTC', color: '#f7931a' },
  { id: 'pm-2', question: 'Will Ethereum flip Solana in daily DEX volume this month?', category: 'Crypto', yesPercent: 41, totalVoters: 8291, volume: '$891K', endsAt: 'Apr 30, 2026', icon: 'ETH', color: '#627eea' },
  { id: 'pm-3', question: 'Will Apple announce a foldable iPhone in 2026?', category: 'Tech', yesPercent: 28, totalVoters: 21456, volume: '$3.1M', endsAt: 'Dec 31, 2026', icon: 'APL', color: '#a2aaad' },
  { id: 'pm-4', question: 'Will the S&P 500 close above 6,000 by end of April?', category: 'Finance', yesPercent: 55, totalVoters: 6734, volume: '$1.7M', endsAt: 'Apr 30, 2026', icon: 'SPX', color: '#22c55e' },
  { id: 'pm-5', question: 'Will OpenAI release GPT-5 before July 2026?', category: 'Tech', yesPercent: 73, totalVoters: 31204, volume: '$5.2M', endsAt: 'Jun 30, 2026', icon: 'AI', color: '#10a37f' },
  { id: 'pm-6', question: 'Will Solana reach $200 this month?', category: 'Crypto', yesPercent: 34, totalVoters: 11502, volume: '$1.2M', endsAt: 'Apr 30, 2026', icon: 'SOL', color: '#9945ff' },
  { id: 'pm-7', question: 'Will there be a US government shutdown in 2026?', category: 'Politics', yesPercent: 47, totalVoters: 9876, volume: '$2.8M', endsAt: 'Dec 31, 2026', icon: 'GOV', color: '#3b82f6' },
  { id: 'pm-8', question: 'Will MegaETH airdrop happen by June 2026?', category: 'Crypto', yesPercent: 43, totalVoters: 18234, volume: '$2.0M', endsAt: 'Jun 30, 2026', icon: 'MEG', color: '#8b5cf6' },
];

/* ─── Prediction Market Inline Component (light theme) ─── */
function PredictionMarketInline({ chatId, saveMessageToChat, wallet }) {
  const [step, setStep] = useState('browse');
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [betSide, setBetSide] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentData, setPaymentData] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [filter, setFilter] = useState('All');
  const MERCHANT_WALLET = 'CsQckUWvnEBURG7h2KzScdCzQp4N879SyDhJ9dbymLFs';

  const categories = ['All', 'Crypto', 'Tech', 'Finance', 'Politics'];
  const filteredMarkets = filter === 'All' ? PREDICTION_MARKETS : PREDICTION_MARKETS.filter(m => m.category === filter);
  const accentColor = '#8b5cf6';

  const formatVoters = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n;
  const potentialPayout = betSide && betAmount ? (parseFloat(betAmount) / (betSide === 'yes' ? (selectedMarket?.yesPercent || 50) / 100 : (100 - (selectedMarket?.yesPercent || 50)) / 100)).toFixed(3) : '0';
  const balance = wallet?.balance;

  const handleSelectMarket = (market) => { setSelectedMarket(market); setBetSide(null); setBetAmount(''); setStep('detail'); };
  const handleConfirmBet = () => { if (!betSide || !betAmount || parseFloat(betAmount) <= 0) return; setStep('checkout'); };

  const handlePayWithWallet = async () => {
    if (!wallet?.sendSOL || !wallet?.publicKey) { setErrorMsg('Wallet not connected'); setStep('error'); return; }
    const amount = parseFloat(betAmount);
    if (balance !== null && balance < amount) { setErrorMsg('Insufficient SOL balance'); setStep('error'); return; }
    setStep('paying');
    try {
      const result = await wallet.sendSOL(MERCHANT_WALLET, amount);
      setPaymentData({ signature: result.signature, amount });
      setPaymentMethod('wallet');
      setStep('confirmed');
      if (chatId && saveMessageToChat) {
        saveMessageToChat(chatId, {
          id: Date.now() + 3000, type: 'ai',
          content: `Prediction bet placed!\n\nMarket: ${selectedMarket.question}\nYour call: ${betSide.toUpperCase()}\nAmount: ${amount} SOL\nPotential payout: ${potentialPayout} SOL\n\nIf your prediction is correct, you'll receive your payout automatically. Good luck!`,
          pending: false,
        });
      }
      if (wallet.refreshBalance) setTimeout(() => wallet.refreshBalance(), 1500);
    } catch (err) { setErrorMsg(err.message); setStep('error'); }
  };

  const handleGenerateQR = async () => {
    setPaymentMethod('qr');
    setStep('generating');
    try {
      const resp = await fetch('/api/solana-pay/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(betAmount), currency: 'SOL', product: { title: `Prediction: ${selectedMarket.question} — ${betSide.toUpperCase()}` } }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to generate payment');
      setPaymentData(data);
      setStep('confirmed');
    } catch (err) { setErrorMsg(err.message); setStep('error'); }
  };

  const stopsColor = (s) => s === 'yes' ? '#22c55e' : '#ef4444';

  return (
    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BarChart3 size={18} color={accentColor} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>
            {step === 'browse' ? 'Prediction Markets' : step === 'detail' ? selectedMarket?.question : step === 'checkout' ? 'Confirm Your Bet' : step === 'confirmed' ? 'Bet Confirmed!' : 'Prediction Markets'}
          </p>
          <p style={{ margin: 0, fontSize: '11px', color: '#6B7280' }}>
            {step === 'browse' ? `${filteredMarkets.length} active markets • Bet with SOL` : step === 'detail' ? `${selectedMarket?.category} • Ends ${selectedMarket?.endsAt}` : step === 'checkout' ? `${betSide?.toUpperCase()} — ${betAmount} SOL` : step === 'confirmed' ? 'Transaction confirmed' : ''}
          </p>
        </div>
      </div>

      {/* STEP: Browse */}
      {step === 'browse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilter(cat)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                  background: filter === cat ? 'rgba(139,92,246,0.1)' : '#F9FAFB',
                  color: filter === cat ? accentColor : '#6B7280' }}>
                {cat}
              </button>
            ))}
          </div>
          {filteredMarkets.map(market => (
            <div key={market.id} onClick={() => handleSelectMarket(market)}
              style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(139,92,246,0.08)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${market.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: market.color, flexShrink: 0, letterSpacing: '-0.3px' }}>{market.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>{market.question}</p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '10px', color: '#6B7280' }}>
                    <span>{market.category}</span><span>•</span><span>{formatVoters(market.totalVoters)} voters</span><span>•</span><span>{market.volume} vol</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${market.yesPercent}%`, background: '#22c55e' }} />
                  <div style={{ width: `${100 - market.yesPercent}%`, background: '#ef4444' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                  <span style={{ color: '#22c55e' }}>Yes {market.yesPercent}%</span>
                  <span style={{ color: '#ef4444' }}>No {100 - market.yesPercent}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STEP: Detail */}
      {step === 'detail' && selectedMarket && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button onClick={() => setStep('browse')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: accentColor, fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>← Back to markets</button>
          <div style={{ padding: '16px', background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${selectedMarket.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: selectedMarket.color, letterSpacing: '-0.3px' }}>{selectedMarket.icon}</div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>{selectedMarket.question}</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>{selectedMarket.category} • Ends {selectedMarket.endsAt}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              {[{ label: 'Volume', value: selectedMarket.volume }, { label: 'Voters', value: formatVoters(selectedMarket.totalVoters) }, { label: 'Ends', value: selectedMarket.endsAt }].map(stat => (
                <div key={stat.label} style={{ flex: 1, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '10px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{stat.value}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${selectedMarket.yesPercent}%`, background: '#22c55e' }} />
                <div style={{ width: `${100 - selectedMarket.yesPercent}%`, background: '#ef4444' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 }}>
                <span style={{ color: '#22c55e' }}>Yes {selectedMarket.yesPercent}%</span>
                <span style={{ color: '#ef4444' }}>No {100 - selectedMarket.yesPercent}%</span>
              </div>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>What's your prediction?</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['yes', 'no'].map(side => (
              <button key={side} onClick={() => setBetSide(side)}
                style={{ flex: 1, padding: '14px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.5px',
                  border: betSide === side ? `2px solid ${side === 'yes' ? '#22c55e' : '#ef4444'}` : '2px solid rgba(0,0,0,0.08)',
                  background: betSide === side ? (side === 'yes' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)') : '#fff',
                  color: betSide === side ? (side === 'yes' ? '#22c55e' : '#ef4444') : '#9CA3AF' }}>
                {side === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
          {betSide && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>How much SOL do you want to bet?</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['0.1', '0.5', '1', '2'].map(amt => (
                  <button key={amt} onClick={() => setBetAmount(amt)}
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                      border: betAmount === amt ? `1px solid ${accentColor}` : '1px solid rgba(0,0,0,0.08)',
                      background: betAmount === amt ? 'rgba(139,92,246,0.06)' : '#fff',
                      color: betAmount === amt ? accentColor : '#6B7280' }}>
                    {amt} SOL
                  </button>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <input type="number" min="0.01" step="0.01" placeholder="Custom amount" value={betAmount} onChange={e => setBetAmount(e.target.value)}
                  style={{ width: '100%', padding: '10px 50px 10px 12px', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: '8px', color: '#111827', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = accentColor} onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.12)'} />
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>SOL</span>
              </div>
              {betAmount && parseFloat(betAmount) > 0 && (
                <div style={{ padding: '10px 12px', background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#6B7280' }}>Potential payout if {betSide.toUpperCase()} wins</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{potentialPayout} SOL</span>
                </div>
              )}
              <button onClick={handleConfirmBet}
                disabled={!betAmount || parseFloat(betAmount) <= 0}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: (!betAmount || parseFloat(betAmount) <= 0) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: (!betAmount || parseFloat(betAmount) <= 0) ? '#F3F4F6' : (betSide === 'yes' ? '#22c55e' : '#ef4444'),
                  color: (!betAmount || parseFloat(betAmount) <= 0) ? '#9CA3AF' : '#fff' }}>
                Place {betSide?.toUpperCase()} Bet — {betAmount || '0'} SOL
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP: Checkout */}
      {step === 'checkout' && selectedMarket && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ padding: '14px', background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${selectedMarket.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: selectedMarket.color, letterSpacing: '-0.3px' }}>{selectedMarket.icon}</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#111827' }}>{selectedMarket.question}</p>
                <p style={{ margin: 0, fontSize: '10px', color: '#6B7280' }}>Ends {selectedMarket.endsAt}</p>
              </div>
              <button onClick={() => setStep('detail')} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '11px', cursor: 'pointer' }}>Change</button>
            </div>
            <div style={{ display: 'flex', gap: '12px', padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '10px', color: '#6B7280', textTransform: 'uppercase' }}>Your Call</p>
                <p style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: 700, color: betSide === 'yes' ? '#22c55e' : '#ef4444' }}>{betSide?.toUpperCase()}</p>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '10px', color: '#6B7280', textTransform: 'uppercase' }}>Amount</p>
                <p style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: 700, color: '#111827' }}>{betAmount} SOL</p>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '10px', color: '#6B7280', textTransform: 'uppercase' }}>Payout</p>
                <p style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: 700, color: accentColor }}>{potentialPayout} SOL</p>
              </div>
            </div>
          </div>
          {balance !== null && (
            <div style={{ padding: '10px 12px', background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#6B7280' }}>Your balance</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: balance >= parseFloat(betAmount) ? '#6B7280' : '#dc2626' }}>{typeof balance === 'number' ? balance.toFixed(4) : balance} SOL</span>
            </div>
          )}
          {balance !== null && balance < parseFloat(betAmount) && (
            <p style={{ margin: 0, fontSize: '11px', color: '#dc2626' }}>Insufficient SOL balance for this bet.</p>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handlePayWithWallet}
              disabled={balance !== null && balance < parseFloat(betAmount)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
                cursor: (balance !== null && balance < parseFloat(betAmount)) ? 'not-allowed' : 'pointer',
                background: (balance !== null && balance < parseFloat(betAmount)) ? '#F3F4F6' : accentColor,
                color: (balance !== null && balance < parseFloat(betAmount)) ? '#9CA3AF' : '#fff' }}
              onMouseOver={e => { if (!(balance !== null && balance < parseFloat(betAmount))) e.currentTarget.style.opacity = '0.9'; }}
              onMouseOut={e => { e.currentTarget.style.opacity = '1'; }}>
              <Wallet size={14} /> Pay {betAmount} SOL
            </button>
            <button onClick={handleGenerateQR}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px 16px', background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: '#6B7280', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={e => e.currentTarget.style.background = '#F3F4F6'}
              onMouseOut={e => e.currentTarget.style.background = '#F9FAFB'}>
              <QrCode size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP: Paying / Generating */}
      {(step === 'paying' || step === 'generating') && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px 0' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: accentColor }} />
          <p style={{ margin: 0, fontSize: '13px', color: '#111827', fontWeight: 500 }}>{step === 'paying' ? 'Processing your bet...' : 'Generating Solana Pay QR...'}</p>
          {step === 'paying' && <p style={{ margin: 0, fontSize: '11px', color: '#6B7280' }}>Confirm the transaction in your wallet</p>}
        </div>
      )}

      {/* STEP: Confirmed */}
      {step === 'confirmed' && paymentData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {paymentMethod === 'wallet' && paymentData.signature && (
            <>
              <div style={{ padding: '16px', background: '#F0FDF4', border: '1px solid rgba(22,163,74,0.2)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><CheckCircle size={40} color="#16a34a" /></div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>Bet Placed!</p>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#6B7280' }}>{selectedMarket?.question}</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: betSide === 'yes' ? '#22c55e' : '#ef4444' }}>{betSide?.toUpperCase()}</span>
                  <span style={{ fontSize: '12px', color: '#9CA3AF' }}>•</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{paymentData.amount} SOL</span>
                  <span style={{ fontSize: '12px', color: '#9CA3AF' }}>•</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: accentColor }}>Payout: {potentialPayout} SOL</span>
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#6B7280', fontWeight: 500 }}>Transaction ID</span>
                  <span style={{ fontSize: '10px', color: '#374151', fontFamily: 'monospace', wordBreak: 'break-all' }}>{paymentData.signature}</span>
                </div>
              </div>
            </>
          )}
          {paymentMethod === 'qr' && paymentData.qrCode && (
            <>
              <div style={{ padding: '12px', background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>Bet: {betSide?.toUpperCase()} — {selectedMarket?.question?.slice(0, 40)}...</span>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>{betAmount} SOL</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><QrCode size={16} color="#6B7280" /><span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>Scan to Pay</span></div>
                <div style={{ width: '140px', height: '140px', background: '#fff', borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <div dangerouslySetInnerHTML={{ __html: paymentData.qrCode }} style={{ maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: '#6B7280', textAlign: 'center' }}>Scan with a Solana wallet to pay</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP: Error */}
      {step === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px' }}>
            <XCircle size={18} color="#dc2626" />
            <span style={{ color: '#dc2626', fontSize: '13px', fontWeight: 500 }}>Bet Failed</span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#374151', fontFamily: 'monospace', wordBreak: 'break-word', padding: '12px', background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '8px' }}>{errorMsg}</p>
          <button onClick={() => setStep('checkout')}
            style={{ background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', padding: '10px', fontSize: '13px', color: '#111827', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseOver={e => e.currentTarget.style.background = '#F3F4F6'}
            onMouseOut={e => e.currentTarget.style.background = '#F9FAFB'}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

export default function ChatMessages({ messages, isLoading, wallet, chatId, saveMessageToChat, updateMessageInChat }) {
    return (
        <div className={styles.messagesWrapper}>
            {messages.length === 0 && !isLoading && (
                <div className={`${styles.emptyState} animate-fade-in`}>
                    {/* SVG Gradient Definition for Shimmer Effect */}
                    {/* Inline SVG with internal gradient for robust shimmer effect */}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="url(#shimmer-gradient)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={styles.emptyIcon}
                    >
                        <defs>
                            <linearGradient id="shimmer-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="var(--text-tertiary)" stopOpacity="0.2" />
                                <stop offset="40%" stopColor="var(--text-tertiary)" stopOpacity="0.2" />
                                <stop offset="50%" stopColor="var(--text-primary)" stopOpacity="1" />
                                <stop offset="60%" stopColor="var(--text-tertiary)" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="var(--text-tertiary)" stopOpacity="0.2" />
                                <animate attributeName="x1" values="-100%; 100%" dur="2s" repeatCount="indefinite" />
                                <animate attributeName="x2" values="0%; 200%" dur="2s" repeatCount="indefinite" />
                            </linearGradient>
                        </defs>
                        <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
                        <path d="M20 2v4" />
                        <path d="M22 4h-4" />
                        <circle cx="4" cy="20" r="2" />
                    </svg>
                    <p className={styles.emptyText}>Start a conversation with Neyrs</p>
                </div>
            )}

            {messages.map((message, index) => (
                <div
                    key={message.id}
                    className={`${message.type === 'user' ? styles.userMessage : styles.aiMessage} ${styles.message}`}
                    style={{ animationDelay: `${index * 50}ms` }}
                >
                    {message.type === 'ai' && (
                        <div className={styles.aiHeader}>
                            <Sparkles size={14} className="text-yellow-500" fill="currentColor" />
                            <span className={styles.aiName}>Neyrs</span>
                        </div>
                    )}

                    <div className={message.type === 'user' ? styles.userBubble : styles.aiBubble}>
                        <div className={message.type === 'ai' ? styles.aiText : ''}>
                            {message.type === 'ai' ? cleanMarkdown(message.content) : message.content}
                        </div>

                        {message.type === 'ai' && <TxResultBadge message={message} />}
                        {message.type === 'ai' && message.priceData && <PriceDisplay data={message.priceData} />}
                        {message.type === 'ai' && message.portfolio && <PortfolioDisplay assets={message.portfolio} />}
                        {message.type === 'ai' && message.amazonProducts && <AmazonDisplay products={message.amazonProducts} />}
                        {message.type === 'ai' && message.flightSearchForm && (
                            <FlightSearchFormInline chatId={chatId} saveMessageToChat={saveMessageToChat} wallet={wallet} />
                        )}
                        {message.type === 'ai' && message.predictionMarketsForm && (
                            <PredictionMarketInline chatId={chatId} saveMessageToChat={saveMessageToChat} wallet={wallet} />
                        )}
                    </div>
                </div>
            ))}

            {isLoading && (
                <div className={`${styles.aiMessage} ${styles.message}`}>
                    <div className={styles.aiHeader}>
                        <span className={styles.aiName}>Neyrs</span>
                    </div>
                    <div className={styles.loadingBubble}>
                        <div className={styles.dot} />
                        <div className={styles.dot} />
                        <div className={styles.dot} />
                    </div>
                </div>
            )}
        </div>
    );
}
