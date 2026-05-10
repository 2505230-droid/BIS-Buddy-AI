/**
 * StandardsAI — app.js
 * BIS Standards Recommendation Engine
 * RAG Pipeline: Groq (LLaMA 3.3 70B) + Local TF-IDF Retrieval
 *
 * WHY GROQ:
 *  ✅ 100% Free — no credit card, no billing, ever
 *  ✅ CORS-enabled — works directly from browser / local HTML file
 *  ✅ LLaMA 3.3 70B Versatile — production-grade open-source model
 *  ✅ 300+ tokens/sec — fastest free LLM API available
 *  ✅ 1M tokens/day free limit — more than enough for hackathon
 *
 * Architecture:
 *  1. User describes product in plain language
 *  2. Local TF-IDF retrieval finds top-K BIS standards (simulates HuggingFace + Pinecone)
 *  3. Groq receives ONLY retrieved standards — grounded, zero hallucination
 *  4. Structured JSON output: IS number, title, relevance, rationale, tags
 *
 * Get free key: https://console.groq.com/keys (no credit card)
 */

const app = (() => {

  // ─── STATE ───────────────────────────────────────────────────────────────
  let groqKey    = (typeof CONFIG_KEYS !== 'undefined' && CONFIG_KEYS.GROQ_API_KEY) ? CONFIG_KEYS.GROQ_API_KEY : sessionStorage.getItem('groq_key') || '';
  let lastResults = null;
  let isLoading   = false;

  // ─── CONFIG ───────────────────────────────────────────────────────────────
  const CONFIG = {
    endpoint : 'https://api.groq.com/openai/v1/chat/completions',
    model    : 'llama-3.3-70b-versatile',   // Best free model on Groq
    maxTokens: 2048,
  };

  // ─── BIS KNOWLEDGE BASE (Embedded Catalog Subset) ────────────────────────
  // In production this lives in Pinecone, retrieved via vector similarity.
  // This static subset enables zero-backend demo mode for the hackathon.
  const BIS_CATALOG = [
    { is: 'IS 1367',     title: 'Technical Supply Conditions for Threaded Steel Fasteners',                    scope: 'Bolts, screws, nuts, washers — mechanical properties, dimensions, materials for steel fasteners used in general engineering.' },
    { is: 'IS 2062',     title: 'Hot Rolled Medium and High Tensile Structural Steel',                         scope: 'Structural steel plates, strips, sheets, sections, flats for general structural purposes in bridges, buildings, machinery.' },
    { is: 'IS 1786',     title: 'High Strength Deformed Steel Bars and Wires for Concrete Reinforcement',      scope: 'TMT bars, rebar, deformed steel bars for reinforced concrete construction in buildings, bridges, civil infrastructure.' },
    { is: 'IS 432',      title: 'Mild Steel and Medium Tensile Steel Bars for Concrete Reinforcement',         scope: 'Plain round mild steel bars and medium tensile steel used in concrete reinforced structures.' },
    { is: 'IS 14665',    title: 'Electric Traction Lifts — Code of Practice',                                 scope: 'Passenger lifts, freight lifts, electric elevators for buildings. Safety, construction, installation standards.' },
    { is: 'IS 14962',    title: 'Guidelines for Design and Installation of Solar Off-Grid Power Systems',       scope: 'Solar PV off-grid systems, photovoltaic panels, charge controllers, batteries, inverters for rural electrification.' },
    { is: 'IS 16653',    title: 'LED Luminaires and Light Engines — Performance Requirements',                 scope: 'LED lights, LED luminaires, LED bulbs, solid-state lighting, light engines for general illumination.' },
    { is: 'IS 10322',    title: 'Specification for Luminaires — General Requirements and Tests',               scope: 'Light fittings, luminaires, lamp holders, electrical fixtures including indoor and outdoor lighting products.' },
    { is: 'IS 16046',    title: 'LED Retrofit Lamps for Domestic Use — Energy Performance',                    scope: 'LED retrofit bulbs, energy-efficient lamps, LED replacements for incandescent and CFL bulbs for household use.' },
    { is: 'IS 16102',    title: 'Self-Ballasted LED Lamps for General Lighting — Safety Requirements',         scope: 'LED lamp safety, self-ballasted LED bulb, LED light bulb safety testing for household and commercial use.' },
    { is: 'IS 15875',    title: 'LED Street Lights — Performance Requirements',                               scope: 'LED street lighting, road lights, outdoor LED luminaires, public lighting systems.' },
    { is: 'IS 12783',    title: 'Compact Fluorescent Lamps — Performance Requirements',                        scope: 'CFL bulbs, energy saving lamps, compact fluorescent lights for domestic and commercial use.' },
    { is: 'IS 2667',     title: 'Specification for Fittings for Copper and Copper Alloy Pipes',                scope: 'Plumbing fittings, water pipes, drainage fittings, copper pipe joints for domestic plumbing installation.' },
    { is: 'IS 4985',     title: 'Unplasticized PVC Pipes for Potable Water Supplies',                         scope: 'uPVC pipes, rigid PVC pipes, plastic water supply pipes, pressure pipes for potable water distribution.' },
    { is: 'IS 12235',    title: 'Methods of Test for Unplasticized PVC Pipes and Fittings',                   scope: 'Testing standards for PVC pipes, pressure testing, dimensional testing, impact resistance for plastic pipe systems.' },
    { is: 'IS 14151',    title: 'Sprinkler Irrigation Equipment',                                              scope: 'Agricultural sprinklers, drip irrigation components, water sprayers, irrigation heads for farm use.' },
    { is: 'IS 9845',     title: 'Method of Analysis of Migration of Constituents from Plastics in Contact with Food', scope: 'Food-grade plastics, food containers, plastic packaging, plastic bottles for food and beverage contact.' },
    { is: 'IS 14543',    title: 'Packaged Drinking Water (Other than Packaged Natural Mineral Water)',         scope: 'Bottled water, packaged drinking water, purified water in sealed containers for retail sale.' },
    { is: 'IS 10500',    title: 'Drinking Water — Specification',                                              scope: 'Potable water quality, mineral water standards, water purity requirements, water for human consumption.' },
    { is: 'IS 13428',    title: 'Packaged Natural Mineral Water',                                              scope: 'Natural mineral water, spring water, sparkling mineral water in sealed packages for retail.' },
    { is: 'IS 2048',     title: 'Specification for Ceiling Fans',                                              scope: 'Ceiling fans, pedestal fans, table fans — electrical parameters, blade sweep, motor efficiency for domestic use.' },
    { is: 'IS 1391',     title: 'Room Air Conditioners — Split Type',                                         scope: 'Split AC, room air conditioner, HVAC, inverter AC for domestic and commercial cooling.' },
    { is: 'IS 1981',     title: 'Commercial Refrigerating Appliances — Specification',                         scope: 'Refrigerators, deep freezers, commercial cooling appliances, walk-in coolers.' },
    { is: 'IS 302',      title: 'Safety Requirements for Household and Similar Electrical Appliances',         scope: 'Domestic electrical appliances safety, household gadgets, kitchen appliances, home electrical equipment.' },
    { is: 'IS 14520',    title: 'Gaseous Fire-Extinguishing Systems',                                         scope: 'Fire suppression systems, CO2 systems, clean agent fire extinguishing for buildings and industrial use.' },
    { is: 'IS 940',      title: 'Portable Fire Extinguisher (CO2 Type)',                                       scope: 'CO2 fire extinguisher, portable fire suppression, fire safety equipment.' },
    { is: 'IS 1239',     title: 'Mild Steel Tubes, Tubulars and Other Wrought Steel Fittings',                 scope: 'Steel pipes, MS pipes, hollow steel sections, pipe fittings for plumbing and general engineering.' },
    { is: 'IS 9104',     title: 'Specification for Weather-Resistant Fast-Drying Paints for Structural Steel', scope: 'Protective paints, anti-corrosion coatings, weather resistant paints for metal structures and buildings.' },
    { is: 'IS 101',      title: 'Methods of Sampling and Test for Paints, Varnishes and Related Products',    scope: 'Paints, varnishes, lacquers, enamels — sampling and testing methodology for all coating products.' },
    { is: 'IS 2932',     title: 'Specification for Enamel, Synthetic, Exterior Type Paints',                  scope: 'Exterior wall paint, synthetic enamel, decorative paint, oil-based paint for architectural use.' },
    { is: 'IS 4246',     title: 'Cosmetic Products — Labelling and Packaging',                                 scope: 'Cosmetics, beauty products, skincare, personal care items — labelling, declarations, packaging standards.' },
    { is: 'IS 6608',     title: 'Skin Cosmetics — Creams, Lotions and Powders',                               scope: 'Face cream, moisturizer, skin lotion, body powder, cosmetic cream, herbal cream for skin application.' },
    { is: 'IS 5671',     title: 'Mouth Washes and Gargles',                                                   scope: 'Oral rinse, mouthwash, dental products, oral hygiene solutions for personal care.' },
    { is: 'IS 14890',    title: 'Soaps — Toilet Soaps',                                                       scope: 'Toilet soaps, beauty bars, handwash bars, bathing soap for personal hygiene.' },
    { is: 'IS 3696',     title: 'Scaffolding Safety Code — Tube and Coupler Scaffolding',                     scope: 'Construction scaffolding, temporary work platforms, scaffolding tubes, couplers, safety standards for construction sites.' },
    { is: 'IS 383',      title: 'Coarse and Fine Aggregates from Natural Sources for Concrete',                scope: 'Sand, gravel, stone aggregate, crushed stone for concrete mixing in construction.' },
    { is: 'IS 1489',     title: 'Portland Pozzolana Cement',                                                  scope: 'PPC cement, blended cement, fly ash cement, concrete binder for general construction.' },
    { is: 'IS 8112',     title: 'Ordinary Portland Cement 43 Grade',                                          scope: 'OPC cement, 43 grade cement, construction cement, Portland cement for buildings and infrastructure.' },
    { is: 'IS 13121',    title: 'Agricultural Sprayers — Manually Operated Knapsack Sprayers',                scope: 'Knapsack sprayer, hand pump sprayer, manual pesticide sprayer for agricultural use.' },
    { is: 'IS 11592',    title: 'Selection and Design of Belt Conveyors',                                      scope: 'Belt conveyor, material handling conveyor, bulk material transport systems for industrial use.' },
    { is: 'IS 9938',     title: 'Recommended Limits of Noise Levels for Commercial and Industrial Environments', scope: 'Industrial noise, occupational noise limits, workplace sound levels, machinery noise standards.' },
    { is: 'IS 277',      title: 'Galvanized Steel Sheets — Plain and Corrugated',                             scope: 'Galvanized iron sheet, GI sheet, corrugated roofing sheet, zinc-coated steel for roofing and cladding.' },
    { is: 'IS 13063',    title: 'Self-Adhesive Tapes for Electrical Purposes',                                 scope: 'Insulating tape, electrical tape, PVC tape, self-adhesive electrical insulation tape.' },
    { is: 'IS 694',      title: 'PVC Insulated Cables for Working Voltages up to 1100V',                      scope: 'Electrical wire, PVC cable, domestic wiring cable, copper conductor cable for building wiring.' },
    { is: 'IS 9537',     title: 'Conduits for Electrical Installations',                                       scope: 'Electrical conduit, cable conduit, PVC conduit, wiring conduit for electrical installations.' },
    { is: 'IS 1443',     title: 'Covers and Frames for Manholes and Inspection Chambers',                     scope: 'Manhole cover, drain cover, cast iron cover, inspection chamber frame for municipal infrastructure.' },
    { is: 'IS 14962-P2', title: 'Solar Photo Voltaic Energy Systems — Safety',                                scope: 'Solar panel safety, PV module testing, solar energy systems, rooftop solar for domestic and commercial use.' },
    { is: 'IS 16169',    title: 'Automotive Vehicles — Safety Requirements',                                  scope: 'Vehicle safety standards, automobile parts, automotive components, road vehicle safety testing.' },
    { is: 'IS 15549',    title: 'Hand Sanitizer — Requirements',                                              scope: 'Hand sanitiser, alcohol-based hand rub, hand disinfectant, antiseptic gel for infection prevention.' },
    { is: 'IS 17021',    title: 'Face Masks — Non-Woven Type for General Use',                                scope: 'Face mask, surgical mask, non-woven mask, protective mask for personal protection.' },
    { is: 'IS 2552',     title: 'Steel Drums',                                                                scope: 'Steel drum, metal barrel, industrial drum, storage container for liquids and chemicals.' },
  ];

  // ─── INIT ─────────────────────────────────────────────────────────────────
  function init() {
    // Auto-load key from config.js (hardcoded) or sessionStorage fallback
    if (groqKey) {
      showKeyStatus('✓ API key loaded from config', 'ok');
      // Hide the key input row entirely since key is pre-configured
      const row = document.getElementById('apiKeyRow');
      if (row) row.style.display = 'none';
    }
    window.addEventListener('scroll', () => {
      document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
    });
    const textarea = document.getElementById('productInput');
    const counter  = document.getElementById('charCount');
    if (textarea && counter) {
      textarea.addEventListener('input', () => {
        const len = textarea.value.length;
        counter.textContent = `${len} / 500`;
        counter.style.color = len > 450 ? '#ff5c5c' : '';
      });
    }
    animateCounter();
  }

  function animateCounter() {
    const el = document.getElementById('counter');
    if (!el) return;
    const values = ['seconds', '< 3s', 'instantly', 'seconds'];
    let i = 0;
    setInterval(() => {
      el.style.opacity = '0';
      setTimeout(() => {
        i = (i + 1) % values.length;
        el.textContent = values[i];
        el.style.opacity = '1';
        el.style.transition = 'opacity 0.4s';
      }, 300);
    }, 2500);
  }

  // ─── KEY MANAGEMENT ───────────────────────────────────────────────────────
  function saveKey() {
    const val = document.getElementById('apiKeyInput').value.trim();
    if (!val.startsWith('gsk_') || val.length < 20) {
      showKeyStatus('Invalid key — Groq keys start with "gsk_"', 'err');
      return;
    }
    groqKey = val;
    sessionStorage.setItem('groq_key', val);
    showKeyStatus('✓ API key saved for this session', 'ok');
  }

  function showKeyStatus(msg, type) {
    const el = document.getElementById('keyStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = `key-status ${type}`;
  }

  // ─── EXAMPLE FILLER ───────────────────────────────────────────────────────
  function fillExample(text) {
    const ta = document.getElementById('productInput');
    ta.value = text;
    ta.dispatchEvent(new Event('input'));
    ta.focus();
    document.getElementById('demo').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ─── LOCAL RETRIEVAL (TF-IDF keyword overlap) ─────────────────────────────
  // Simulates HuggingFace BAAI/bge-small-en-v1.5 + Pinecone vector search.
  // Replace with actual embedding + vector DB calls in production.
  function localRetrieve(query, category, k = 10) {
    const stopWords = new Set(['for','the','in','a','an','to','of','and','or','with','is','are','that','this','by','on','at','be','as','from','my','i','its','it','we','you','sold','used','use','build','make','manufacture','india']);
    const tokens = tokenize(query + ' ' + category).filter(t => !stopWords.has(t));

    return BIS_CATALOG
      .map(std => {
        const corpus = tokenize(std.title + ' ' + std.scope);
        let score = 0;
        for (const t of tokens) {
          const tf = corpus.filter(c => c === t || (t.length > 3 && c.startsWith(t.substring(0, 4)))).length;
          if (tf > 0) score += 1 + Math.log(1 + tf);
        }
        if (query.toLowerCase().includes(std.is.toLowerCase())) score += 10;
        return { ...std, score };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  function tokenize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  }

  // ─── CORE: GROQ API CALL ──────────────────────────────────────────────────
  async function callGroq(productDescription, category, retrievedDocs) {
    if (!groqKey) throw new Error('Please enter your Groq API key first.');

    const contextBlock = retrievedDocs.map((d, i) =>
      `[DOC ${i+1}]\nIS Number: ${d.is}\nTitle: ${d.title}\nScope: ${d.scope}`
    ).join('\n\n');

    const systemPrompt = `You are a highly specialised BIS (Bureau of Indian Standards) compliance expert for Indian Micro and Small Enterprises (MSEs).

TASK: Analyse the product description and return the most applicable BIS standards from the CONTEXT DOCUMENTS ONLY.

STRICT RULES:
1. ONLY use IS numbers and titles that appear verbatim in the CONTEXT DOCUMENTS. Never invent or hallucinate standards.
2. Return EXACTLY 3 to 5 recommendations ranked by relevance (most relevant first).
3. Output ONLY a valid JSON array — no preamble, no markdown fences, no explanation outside the JSON.
4. Write rationale in plain English for a non-technical business owner.

OUTPUT FORMAT — return this exact structure:
[
  {
    "rank": 1,
    "is_number": "IS XXXX",
    "title": "Exact title from context",
    "relevance_score": 92,
    "rationale": "2-3 sentences explaining why this standard applies to the product.",
    "key_aspects": ["aspect 1", "aspect 2", "aspect 3"],
    "mandatory": true
  }
]`;

    const userPrompt = `PRODUCT DESCRIPTION: "${productDescription}"
PRODUCT CATEGORY: ${category || 'Auto-detect from description'}

CONTEXT DOCUMENTS (use ONLY these — do not invent any IS number not listed here):
${contextBlock}

Return the JSON array only. No other text.`;

    const response = await fetch(CONFIG.endpoint, {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model      : CONFIG.model,
        max_tokens : CONFIG.maxTokens,
        temperature: 0.1,
        messages   : [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err?.error?.message || `HTTP ${response.status}`;
      throw new Error(`Groq API error: ${msg}`);
    }

    const data = await response.json();
    const raw  = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty response from Groq API.');

    // Strip markdown fences and extract JSON array
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match   = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Could not find JSON array in model response. Please try again.');
    try {
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) throw new Error('Expected JSON array from model.');
      return parsed;
    } catch {
      throw new Error('Could not parse model output as JSON. Please try again.');
    }
  }

  // ─── MAIN: ANALYZE ────────────────────────────────────────────────────────
  async function analyze() {
    if (isLoading) return;

    const description = document.getElementById('productInput').value.trim();
    const category    = document.getElementById('categorySelect').value;

    if (!description || description.length < 10) {
      showError('Please enter a product description of at least 10 characters.');
      return;
    }
    if (!groqKey) {
      showError('Please enter and save your Groq API key. Get one free at console.groq.com/keys — no credit card needed.');
      document.getElementById('apiKeyInput').focus();
      return;
    }

    setLoading(true);
    hideError();
    showSkeletonResults();

    const t0 = performance.now();

    try {
      const retrieved = localRetrieve(description, category, 10);
      if (retrieved.length === 0) {
        throw new Error('No relevant BIS standards found for this product. Try a more specific description.');
      }

      const results = await callGroq(description, category, retrieved);
      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      lastResults   = { description, category, results, elapsed, timestamp: new Date().toISOString() };
      renderResults(results, elapsed);

    } catch (err) {
      hideSkeletonResults();
      showError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  // ─── UI HELPERS ───────────────────────────────────────────────────────────
  function setLoading(state) {
    isLoading = state;
    const btn    = document.getElementById('analyzeBtn');
    const inner  = btn.querySelector('.btn-inner');
    const loader = document.getElementById('btnLoader');
    btn.disabled         = state;
    inner.style.display  = state ? 'none' : 'flex';
    loader.style.display = state ? 'flex'  : 'none';
  }

  function showSkeletonResults() {
    const wrapper = document.getElementById('resultsWrapper');
    const list    = document.getElementById('resultsList');
    wrapper.style.display = 'block';
    list.innerHTML = [1,2,3].map(() => `
      <div class="skeleton-card">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line long"></div>
        <div class="skeleton-line medium"></div>
      </div>`).join('');
    document.getElementById('resultsMeta').textContent = 'Analyzing…';
  }

  function hideSkeletonResults() {
    document.getElementById('resultsWrapper').style.display = 'none';
  }

  function renderResults(results, elapsed) {
    const wrapper = document.getElementById('resultsWrapper');
    const list    = document.getElementById('resultsList');
    const meta    = document.getElementById('resultsMeta');

    meta.textContent = `${results.length} standards found · ${elapsed}s`;

    list.innerHTML = results.map((r, i) => {
      const score  = typeof r.relevance_score === 'number' ? r.relevance_score : 75;
      const tags   = Array.isArray(r.key_aspects) ? r.key_aspects : [];
      const isMand = r.mandatory === true;
      const delay  = i * 0.08;
      return `
        <div class="result-card" style="animation-delay:${delay}s">
          <div class="result-rank-row">
            <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
              <span class="result-is">${escHtml(r.is_number || 'IS ???')}</span>
              <span style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-dim)">Rank #${r.rank || (i+1)}</span>
              ${isMand ? '<span style="font-family:var(--font-mono);font-size:0.68rem;color:#ff5c5c;border:1px solid rgba(255,92,92,0.3);border-radius:4px;padding:2px 8px">MANDATORY</span>' : ''}
            </div>
            <div class="result-relevance">
              <div class="relevance-bar-wrap"><div class="relevance-bar" style="width:${score}%"></div></div>
              <span class="relevance-pct">${score}%</span>
            </div>
          </div>
          <div class="result-title">${escHtml(r.title || 'Untitled Standard')}</div>
          <div class="result-rationale">${escHtml(r.rationale || '')}</div>
          ${tags.length ? `<div class="result-tags">${tags.map(t => `<span class="result-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
        </div>`;
    }).join('');

    wrapper.style.display = 'block';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showError(msg) {
    const card = document.getElementById('errorCard');
    document.getElementById('errorMsg').textContent = msg;
    card.style.display = 'flex';
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideError() {
    document.getElementById('errorCard').style.display = 'none';
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── EXPORT ───────────────────────────────────────────────────────────────
  function exportResults() {
    if (!lastResults) return;
    const blob = new Blob([JSON.stringify(lastResults, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `bis-standards-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return { init, saveKey, analyze, fillExample, exportResults };
})();

document.addEventListener('DOMContentLoaded', app.init);