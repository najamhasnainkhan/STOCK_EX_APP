export const COUNTRIES = {
  US: { name: 'United States', exchange: 'NYSE / NASDAQ', index: '^GSPC', stocks: { AAPL: 'Apple', MSFT: 'Microsoft', GOOGL: 'Alphabet', AMZN: 'Amazon', JPM: 'JPMorgan' } },
  GB: { name: 'United Kingdom', exchange: 'London Stock Exchange', index: '^FTSE', stocks: { 'SHEL.L': 'Shell', 'AZN.L': 'AstraZeneca', 'HSBA.L': 'HSBC', 'ULVR.L': 'Unilever', 'BP.L': 'BP' } },
  JP: { name: 'Japan', exchange: 'Tokyo Stock Exchange', index: '^N225', stocks: { '7203.T': 'Toyota', '6758.T': 'Sony', '9984.T': 'SoftBank Group', '8306.T': 'Mitsubishi UFJ', '7974.T': 'Nintendo' } },
  DE: { name: 'Germany', exchange: 'Xetra (Frankfurt)', index: '^GDAXI', stocks: { 'SAP.DE': 'SAP', 'SIE.DE': 'Siemens', 'ALV.DE': 'Allianz', 'BMW.DE': 'BMW', 'DTE.DE': 'Deutsche Telekom' } },
  IN: { name: 'India', exchange: 'NSE / BSE', index: '^NSEI', stocks: { 'RELIANCE.NS': 'Reliance', 'TCS.NS': 'TCS', 'INFY.NS': 'Infosys', 'HDFCBANK.NS': 'HDFC Bank', 'ITC.NS': 'ITC' } },
  HK: { name: 'Hong Kong', exchange: 'HKEX', index: '^HSI', stocks: { '0700.HK': 'Tencent', '9988.HK': 'Alibaba', '0005.HK': 'HSBC Holdings', '1299.HK': 'AIA', '0941.HK': 'China Mobile' } },
  FR: { name: 'France', exchange: 'Euronext Paris', index: '^FCHI', stocks: { 'MC.PA': 'LVMH', 'OR.PA': "L'Oréal", 'TTE.PA': 'TotalEnergies', 'AIR.PA': 'Airbus', 'SAN.PA': 'Sanofi' } },
  CA: { name: 'Canada', exchange: 'Toronto Stock Exchange', index: '^GSPTSE', stocks: { 'RY.TO': 'Royal Bank', 'SHOP.TO': 'Shopify', 'TD.TO': 'TD Bank', 'ENB.TO': 'Enbridge', 'CNQ.TO': 'Canadian Natural' } },
};

const cache = new Map();
const TTL = 15000;

async function fetchOne(symbol) {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  let v;
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
    );
    const m = (await r.json()).chart.result[0].meta;
    const price = m.regularMarketPrice;
    const prev = m.chartPreviousClose ?? m.previousClose ?? price;
    v = { symbol, price, prev, change: price - prev, pct: prev ? ((price - prev) / prev) * 100 : 0, currency: m.currency, live: true };
  } catch {
    if (hit) return { ...hit.v, live: false };
    return { symbol, price: null, prev: null, change: 0, pct: 0, currency: '', live: false };
  }
  cache.set(symbol, { t: Date.now(), v });
  return v;
}

export const getQuotes = (symbols) => Promise.all(symbols.map(fetchOne));

export function findName(symbol) {
  for (const [code, c] of Object.entries(COUNTRIES)) {
    if (c.stocks[symbol]) return { name: c.stocks[symbol], country: code };
  }
  return null;
}
