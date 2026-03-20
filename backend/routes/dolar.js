const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// Cache so we don't hammer the external API
let cache = { rate: null, date: null, fetchedAt: null };
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// GET /api/dolar - returns current USD/UYU billete rate from BCU
router.get('/', async (req, res) => {
  try {
    const now = Date.now();

    // Return cached value if fresh
    if (cache.rate && cache.fetchedAt && (now - cache.fetchedAt) < CACHE_TTL_MS) {
      return res.json({ rate: cache.rate, date: cache.date, source: 'cache' });
    }

    // Try BCU (Banco Central del Uruguay) cotizaciones API
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();

    // BCU API: cotización dólar billete vendedor
    const url = `https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/wsbcucotizaciones?` +
      `FechaDesde=${dd}%2F${mm}%2F${yyyy}&` +
      `FechaHasta=${dd}%2F${mm}%2F${yyyy}&` +
      `Moneda=2225&Grupo=0`;  // 2225 = USD billete

    let rate = null;
    let dateStr = `${dd}/${mm}/${yyyy}`;

    try {
      const response = await fetch(url, {
        timeout: 8000,
        headers: { 'Accept': 'application/json, text/xml' }
      });

      if (response.ok) {
        const text = await response.text();
        // BCU returns XML-like or JSON; try to extract the vendedor value
        // The response typically contains <VENTABILLETES> or similar
        const ventaMatch = text.match(/<VENTA>([0-9.]+)<\/VENTA>/i) ||
                          text.match(/"venta"\s*:\s*"?([0-9.]+)"?/i) ||
                          text.match(/VENTABILLETES[^>]*>([0-9.]+)</i) ||
                          text.match(/([0-9]{2}\.[0-9]{2,4})/);
        if (ventaMatch) {
          rate = parseFloat(ventaMatch[1]);
        }
      }
    } catch (fetchErr) {
      console.warn('BCU fetch failed:', fetchErr.message);
    }

    // Fallback: try secondary source (dolarito.ar API for UYU)
    if (!rate || rate < 30) {
      try {
        const resp2 = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { timeout: 6000 });
        if (resp2.ok) {
          const data = await resp2.json();
          if (data.rates && data.rates.UYU) {
            rate = parseFloat(data.rates.UYU.toFixed(2));
          }
        }
      } catch (e) {
        console.warn('Fallback exchange rate fetch failed:', e.message);
      }
    }

    // Last resort fallback (approximate)
    if (!rate || rate < 30) {
      rate = null; // Let the client know no rate is available
    }

    if (rate) {
      cache = { rate, date: dateStr, fetchedAt: now };
    }

    res.json({ rate, date: dateStr, source: rate ? 'live' : 'unavailable' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dolar/manual - set manual override
router.post('/manual', async (req, res) => {
  try {
    const { rate } = req.body;
    if (!rate || isNaN(rate) || rate <= 0) return res.status(400).json({ error: 'Valor inválido' });
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
    cache = { rate: parseFloat(rate), date: dateStr, fetchedAt: Date.now() };
    res.json({ rate: cache.rate, date: cache.date, source: 'manual' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
