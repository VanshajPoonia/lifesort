-- Create payment logs table to track all Buy Me a Coffee payments
CREATE TABLE IF NOT EXISTS payment_logs (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  coffees INTEGER NOT NULL,
  note TEXT,
  processed BOOLEAN DEFAULT false,
  user_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_logs_email ON payment_logs(email);
CREATE INDEX IF NOT EXISTS idx_payment_logs_processed ON payment_logs(processed);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at ON payment_logs(created_at DESC);
