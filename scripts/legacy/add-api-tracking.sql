-- Track API usage for rate limiting
CREATE TABLE IF NOT EXISTS api_usage (
  id SERIAL PRIMARY KEY,
  api_name VARCHAR(100) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER DEFAULT 0,
  max_requests INTEGER DEFAULT 25,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(api_name, date)
);

-- Track when each user's investments were last fetched
ALTER TABLE users ADD COLUMN IF NOT EXISTS investments_last_fetched TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS investments_fetch_priority INTEGER DEFAULT 0;

-- Popular stocks/ETFs for quick selection
CREATE TABLE IF NOT EXISTS popular_investments (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  region VARCHAR(50) DEFAULT 'US',
  currency VARCHAR(10) DEFAULT 'USD',
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert popular US stocks
INSERT INTO popular_investments (symbol, name, type, region, currency, category) VALUES
('AAPL', 'Apple Inc.', 'Stocks', 'US', 'USD', 'Technology'),
('MSFT', 'Microsoft Corporation', 'Stocks', 'US', 'USD', 'Technology'),
('GOOGL', 'Alphabet Inc.', 'Stocks', 'US', 'USD', 'Technology'),
('AMZN', 'Amazon.com Inc.', 'Stocks', 'US', 'USD', 'Technology'),
('NVDA', 'NVIDIA Corporation', 'Stocks', 'US', 'USD', 'Technology'),
('TSLA', 'Tesla Inc.', 'Stocks', 'US', 'USD', 'Automotive'),
('META', 'Meta Platforms Inc.', 'Stocks', 'US', 'USD', 'Technology'),
('JPM', 'JPMorgan Chase & Co.', 'Stocks', 'US', 'USD', 'Finance'),
('V', 'Visa Inc.', 'Stocks', 'US', 'USD', 'Finance'),
('JNJ', 'Johnson & Johnson', 'Stocks', 'US', 'USD', 'Healthcare'),
('WMT', 'Walmart Inc.', 'Stocks', 'US', 'USD', 'Retail'),
('PG', 'Procter & Gamble Co.', 'Stocks', 'US', 'USD', 'Consumer Goods'),
('DIS', 'Walt Disney Co.', 'Stocks', 'US', 'USD', 'Entertainment'),
('NFLX', 'Netflix Inc.', 'Stocks', 'US', 'USD', 'Entertainment'),
('AMD', 'Advanced Micro Devices', 'Stocks', 'US', 'USD', 'Technology')
ON CONFLICT (symbol) DO NOTHING;

-- Insert popular ETFs
INSERT INTO popular_investments (symbol, name, type, region, currency, category) VALUES
('SPY', 'SPDR S&P 500 ETF', 'ETF', 'US', 'USD', 'Index'),
('QQQ', 'Invesco QQQ Trust', 'ETF', 'US', 'USD', 'Technology'),
('VOO', 'Vanguard S&P 500 ETF', 'ETF', 'US', 'USD', 'Index'),
('VTI', 'Vanguard Total Stock Market ETF', 'ETF', 'US', 'USD', 'Index'),
('IWM', 'iShares Russell 2000 ETF', 'ETF', 'US', 'USD', 'Small Cap'),
('DIA', 'SPDR Dow Jones Industrial ETF', 'ETF', 'US', 'USD', 'Index'),
('GLD', 'SPDR Gold Shares', 'ETF', 'US', 'USD', 'Commodities'),
('VNQ', 'Vanguard Real Estate ETF', 'ETF', 'US', 'USD', 'Real Estate')
ON CONFLICT (symbol) DO NOTHING;

-- Insert popular Indian stocks
INSERT INTO popular_investments (symbol, name, type, region, currency, category) VALUES
('RELIANCE.NSE', 'Reliance Industries', 'Stocks', 'India', 'INR', 'Conglomerate'),
('TCS.NSE', 'Tata Consultancy Services', 'Stocks', 'India', 'INR', 'Technology'),
('INFY.NSE', 'Infosys Ltd.', 'Stocks', 'India', 'INR', 'Technology'),
('HDFCBANK.NSE', 'HDFC Bank Ltd.', 'Stocks', 'India', 'INR', 'Finance'),
('ICICIBANK.NSE', 'ICICI Bank Ltd.', 'Stocks', 'India', 'INR', 'Finance'),
('HINDUNILVR.NSE', 'Hindustan Unilever', 'Stocks', 'India', 'INR', 'Consumer Goods'),
('SBIN.NSE', 'State Bank of India', 'Stocks', 'India', 'INR', 'Finance'),
('BHARTIARTL.NSE', 'Bharti Airtel Ltd.', 'Stocks', 'India', 'INR', 'Telecom'),
('ITC.NSE', 'ITC Ltd.', 'Stocks', 'India', 'INR', 'Consumer Goods'),
('WIPRO.NSE', 'Wipro Ltd.', 'Stocks', 'India', 'INR', 'Technology')
ON CONFLICT (symbol) DO NOTHING;

-- Insert popular crypto
INSERT INTO popular_investments (symbol, name, type, region, currency, category) VALUES
('BTC', 'Bitcoin', 'Crypto', 'Global', 'USD', 'Cryptocurrency'),
('ETH', 'Ethereum', 'Crypto', 'Global', 'USD', 'Cryptocurrency'),
('SOL', 'Solana', 'Crypto', 'Global', 'USD', 'Cryptocurrency'),
('XRP', 'Ripple', 'Crypto', 'Global', 'USD', 'Cryptocurrency'),
('ADA', 'Cardano', 'Crypto', 'Global', 'USD', 'Cryptocurrency'),
('DOGE', 'Dogecoin', 'Crypto', 'Global', 'USD', 'Cryptocurrency'),
('DOT', 'Polkadot', 'Crypto', 'Global', 'USD', 'Cryptocurrency'),
('MATIC', 'Polygon', 'Crypto', 'Global', 'USD', 'Cryptocurrency')
ON CONFLICT (symbol) DO NOTHING;
