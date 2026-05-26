-- Cache de logo + color por institución para mostrar branding en /banks
-- sin tener que llamar Plaid en cada render. Se popula en /api/plaid/exchange.
ALTER TABLE plaid_items
  ADD COLUMN IF NOT EXISTS logo           TEXT,  -- data:image/png;base64,...
  ADD COLUMN IF NOT EXISTS primary_color  TEXT;  -- #hex
