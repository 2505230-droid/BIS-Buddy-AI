/**
 * StandardsAI — app.js
 * BIS Standards Recommendation Engine — Enhanced with Clauses & Sections
 *
 * Each result now returns:
 *  - BIS Code (IS number)
 *  - Title
 *  - Relevance Score
 *  - Why Applicable (plain English rationale)
 *  - Relevant Sections & Clause Snippets
 *  - Applicability Paragraph
 *  - Source (BIS portal link)
 */

const app = (() => {

  let lastResults = null;
  let isLoading   = false;

  const CONFIG = {
    endpoint : '/api/chat',
    model    : 'llama-3.3-70b-versatile',
    maxTokens: 4096,
  };

  // ─── BIS KNOWLEDGE BASE WITH SECTIONS & CLAUSES ───────────────────────────
  const BIS_CATALOG = [
    {
      is: 'IS 1786', title: 'High Strength Deformed Steel Bars and Wires for Concrete Reinforcement',
      scope: 'TMT bars, rebar, deformed steel bars for reinforced concrete construction in buildings, bridges, civil infrastructure.',
      sections: [
        { clause: '4.1', heading: 'Chemical Composition', snippet: 'Steel shall conform to chemical composition limits for C, Mn, S, P, and CEV (carbon equivalent value) as specified in Table 1.' },
        { clause: '5.2', heading: 'Tensile Properties', snippet: 'Minimum yield stress 500 MPa, UTS 545 MPa, % elongation ≥12% for Fe 500 grade bars.' },
        { clause: '6.0', heading: 'Dimensional Tolerances', snippet: 'Mass per metre shall not vary by more than ±4.5% for bars above 10mm diameter.' },
        { clause: '9.0', heading: 'BIS Certification Mark', snippet: 'Bars shall carry ISI mark under mandatory certification. Manufacturer must hold BIS licence under CRS.' },
      ],
      applicability: 'Mandatory under CRS (Compulsory Registration Scheme). Any manufacturer or importer of TMT bars/rebar for construction in India must comply and obtain BIS licence.',
      source: 'https://www.bis.gov.in/product/IS1786'
    },
    {
      is: 'IS 2062', title: 'Hot Rolled Medium and High Tensile Structural Steel',
      scope: 'Structural steel plates, strips, sheets, sections for bridges, buildings, machinery.',
      sections: [
        { clause: '4.0', heading: 'Grades', snippet: 'Seven grades: E165, E250, E300, E350, E410, E450, E550 covering yield strength from 165 to 550 MPa.' },
        { clause: '5.1', heading: 'Chemical Composition', snippet: 'Carbon content max 0.23% for E250 grade; Sulphur and Phosphorus each max 0.045%.' },
        { clause: '7.2', heading: 'Charpy Impact Test', snippet: 'Impact energy minimum 27J at 0°C for sub-zero applications as per Table 4.' },
        { clause: '10.0', heading: 'Marking', snippet: 'Each product shall be marked with grade designation, manufacturers name, heat number and IS mark.' },
      ],
      applicability: 'Applicable to manufacturers of structural steel products. Mandatory BIS licence required for domestic sale in India.',
      source: 'https://www.bis.gov.in/product/IS2062'
    },
    {
      is: 'IS 432', title: 'Mild Steel and Medium Tensile Steel Bars for Concrete Reinforcement',
      scope: 'Plain round mild steel bars and medium tensile steel used in concrete reinforced structures.',
      sections: [
        { clause: '3.1', heading: 'Grades', snippet: 'Two grades: Grade I (mild steel) and Grade II (medium tensile steel) with distinct mechanical properties.' },
        { clause: '5.0', heading: 'Tensile Requirements', snippet: 'Grade I: Min yield stress 250 MPa, min elongation 23%. Grade II: min yield stress 350 MPa.' },
        { clause: '8.0', heading: 'Sampling', snippet: 'One test per 10 tonnes or part thereof for tensile and bend tests.' },
      ],
      applicability: 'Applicable for plain mild steel bars used in reinforced concrete. Mandatory BIS certification required.',
      source: 'https://www.bis.gov.in/product/IS432'
    },
    {
      is: 'IS 16046', title: 'LED Retrofit Lamps for Domestic and Similar General Lighting Purposes — Energy Performance',
      scope: 'LED retrofit bulbs, energy-efficient lamps, LED replacements for incandescent and CFL bulbs for household use.',
      sections: [
        { clause: '5.1', heading: 'Luminous Efficacy', snippet: 'Minimum luminous efficacy of 90 lm/W for lamps rated 3W–10W; 100 lm/W for lamps above 10W.' },
        { clause: '5.3', heading: 'Power Factor', snippet: 'Power factor shall be ≥0.9 for lamps above 5W when tested at rated voltage and frequency.' },
        { clause: '6.2', heading: 'Colour Rendering Index', snippet: 'CRI (Ra) shall not be less than 80 for all domestic LED lamps under this standard.' },
        { clause: '7.0', heading: 'Life and Lumen Maintenance', snippet: 'Minimum rated life 15,000 hours; lumen maintenance ≥70% (L70) at end of rated life.' },
        { clause: '9.0', heading: 'Marking', snippet: 'Lamp shall be marked with wattage, lumen output, CCT, CRI, rated life, and BIS certification mark.' },
      ],
      applicability: 'Mandatory under BIS CRS for LED lamps sold in India. Every 9W E27 household LED lamp must be BIS-certified under this standard before sale.',
      source: 'https://www.bis.gov.in/product/IS16046'
    },
    {
      is: 'IS 16102', title: 'Self-Ballasted LED Lamps for General Lighting Services — Safety Requirements',
      scope: 'LED lamp safety, self-ballasted LED bulb, LED light bulb safety testing for household and commercial use.',
      sections: [
        { clause: '4.0', heading: 'General Safety', snippet: 'Lamp shall be so constructed that in normal use there is no risk of electric shock, fire, or injury.' },
        { clause: '8.1', heading: 'Creepage and Clearance', snippet: 'Minimum creepage distance 3mm and clearance 2mm between live parts and accessible surfaces.' },
        { clause: '10.0', heading: 'Thermal Test', snippet: 'Surface temperature of accessible parts shall not exceed 75°C above ambient under normal operating conditions.' },
        { clause: '12.0', heading: 'Dielectric Strength', snippet: 'Lamp shall withstand 4000V AC for 1 minute between live parts and accessible metal parts without breakdown.' },
      ],
      applicability: 'Companion safety standard to IS 16046. Both standards together are mandatory for any LED bulb sold in India. Covers electrical safety, thermal limits, and insulation.',
      source: 'https://www.bis.gov.in/product/IS16102'
    },
    {
      is: 'IS 16653', title: 'LED Luminaires and Light Engines — Performance Requirements',
      scope: 'LED light fittings, LED fixtures, LED modules and light engines for general illumination.',
      sections: [
        { clause: '5.2', heading: 'Initial Luminous Flux', snippet: 'Measured luminous flux shall be within ±10% of the declared value at 25°C ambient.' },
        { clause: '6.0', heading: 'Chromaticity', snippet: 'Colour rendering index CRI ≥80; chromaticity coordinates within MacAdam 5-step ellipse from nominal CCT.' },
        { clause: '8.1', heading: 'Lifetime', snippet: 'L70B50 lifetime shall be declared by manufacturer and verified by TM-21 projection method.' },
      ],
      applicability: 'Applies to LED luminaires (complete fittings), separate from lamp standards. Required for LED tube lights, downlights, panel lights sold in India.',
      source: 'https://www.bis.gov.in/product/IS16653'
    },
    {
      is: 'IS 10322', title: 'Specification for Luminaires — General Requirements and Tests',
      scope: 'Light fittings, luminaires, lamp holders, electrical fixtures for indoor and outdoor use.',
      sections: [
        { clause: '3.1', heading: 'Classification', snippet: 'Luminaires classified by protection against electric shock (Class I, II, III) and IP protection level.' },
        { clause: '9.0', heading: 'Mechanical Strength', snippet: 'Luminaire shall withstand impact test of 0.2J without damage to live parts or degradation of protection.' },
        { clause: '12.0', heading: 'Endurance Test', snippet: 'Switching test: 6000 cycles at rated voltage; temperature cycling over 24-hour period without failure.' },
      ],
      applicability: 'General safety standard for all luminaires. Applies in addition to product-specific performance standards like IS 16046 or IS 16653.',
      source: 'https://www.bis.gov.in/product/IS10322'
    },
    {
      is: 'IS 15875', title: 'LED Street Light Luminaires — Performance Requirements',
      scope: 'LED street lighting, road lights, outdoor LED luminaires for public lighting.',
      sections: [
        { clause: '5.1', heading: 'Luminous Efficacy', snippet: 'Minimum 80 lm/W system efficacy for street lighting luminaires at rated conditions.' },
        { clause: '6.0', heading: 'IP Rating', snippet: 'Minimum IP65 protection required for outdoor installation — dust tight and water jet resistant.' },
        { clause: '7.0', heading: 'Surge Protection', snippet: 'Minimum 10kV surge withstand per IEC 61547 for outdoor street lighting applications.' },
      ],
      applicability: 'Applicable if product is street or outdoor lighting. Mandatory for supply to government tenders and Smart City projects in India.',
      source: 'https://www.bis.gov.in/product/IS15875'
    },
    {
      is: 'IS 14543', title: 'Packaged Drinking Water (Other than Packaged Natural Mineral Water)',
      scope: 'Bottled water, packaged drinking water, purified water in sealed containers for retail sale.',
      sections: [
        { clause: '4.1', heading: 'Physical Requirements', snippet: 'Water shall be colourless, odourless, and free from turbidity exceeding 1 NTU.' },
        { clause: '5.0', heading: 'Chemical Requirements', snippet: 'Total dissolved solids max 500 mg/L; pH 6.5–8.5; Nitrates max 45 mg/L; Fluorides max 1.0 mg/L.' },
        { clause: '6.0', heading: 'Microbiological Requirements', snippet: 'Zero coliforms per 100mL; total plate count ≤100 CFU/mL at 37°C after 48 hours.' },
        { clause: '8.0', heading: 'Packaging', snippet: 'Containers shall be food-grade, non-toxic, sealed and conform to IS 9845 migration standards.' },
        { clause: '10.0', heading: 'Labelling', snippet: 'Label shall mention source of water, treatment process, Best Before date, and BIS certification mark.' },
      ],
      applicability: 'Mandatory BIS certification under CRS. Any packaged drinking water sold in India (including 1L PET bottles) must be certified under IS 14543.',
      source: 'https://www.bis.gov.in/product/IS14543'
    },
    {
      is: 'IS 2048', title: 'Specification for Ceiling Fans',
      scope: 'Ceiling fans, pedestal fans, table fans — electrical parameters, blade sweep, motor efficiency.',
      sections: [
        { clause: '5.1', heading: 'Air Delivery', snippet: 'Minimum air delivery 210 CMM for 1200mm sweep ceiling fans at high speed.' },
        { clause: '5.2', heading: 'Service Value', snippet: 'Service value (air delivery/watt) minimum 4.0 CMM/W for non-BLDC fans; 8.0 CMM/W for BLDC fans.' },
        { clause: '6.0', heading: 'Safety', snippet: 'Fan shall comply with IS 302-1 for electrical safety including motor insulation class E or better.' },
        { clause: '7.0', heading: 'Star Labelling', snippet: 'Ceiling fans above 50W are covered under BEE Star Labelling mandatory scheme from Jan 2023.' },
      ],
      applicability: 'Mandatory BIS certification + BEE Star Label for ceiling fans sold in India. Applicable to BLDC and conventional induction motor ceiling fans.',
      source: 'https://www.bis.gov.in/product/IS2048'
    },
    {
      is: 'IS 302', title: 'Safety of Household and Similar Electrical Appliances',
      scope: 'Domestic electrical appliances safety, household gadgets, kitchen appliances, home electrical equipment.',
      sections: [
        { clause: '6.0', heading: 'Classification', snippet: 'Appliances classified as Class I (earthed), Class II (double insulated), or Class III (SELV).' },
        { clause: '13.0', heading: 'Leakage Current', snippet: 'Leakage current shall not exceed 0.75mA for Class I and 0.25mA for Class II appliances.' },
        { clause: '19.0', heading: 'Abnormal Operation', snippet: 'Appliance shall not cause fire, electric shock, or injury under stall, overvoltage or blocked-air conditions.' },
        { clause: '22.0', heading: 'Construction', snippet: 'Appliance shall be so constructed that in normal use, live parts are not accessible to user.' },
      ],
      applicability: 'Umbrella safety standard for all household electrical appliances. Companion standard to all product-specific standards (fans, ACs, refrigerators, etc.).',
      source: 'https://www.bis.gov.in/product/IS302'
    },
    {
      is: 'IS 1391', title: 'Room Air Conditioners',
      scope: 'Split AC, room air conditioner, HVAC, window AC, inverter AC for domestic and commercial cooling.',
      sections: [
        { clause: '4.0', heading: 'Capacity Rating', snippet: 'Cooling capacity tested at outdoor 35°C DB/24°C WB, indoor 27°C DB/19°C WB as per IS 1391 conditions.' },
        { clause: '5.1', heading: 'Energy Efficiency Ratio', snippet: 'Minimum EER/ISEER specified per tonnage; BEE 5-star threshold updated annually. Mandatory Star Label.' },
        { clause: '7.0', heading: 'Refrigerant', snippet: 'Use of non-ODS refrigerants (R32, R410A) required; refrigerant charge shall be marked on unit.' },
      ],
      applicability: 'Mandatory BIS + BEE Star Label for all room ACs sold in India. Split ACs, window ACs, and cassette type all covered.',
      source: 'https://www.bis.gov.in/product/IS1391'
    },
    {
      is: 'IS 4985', title: 'Unplasticized PVC Pipes for Potable Water Supplies',
      scope: 'uPVC pipes, rigid PVC pipes, plastic water supply pipes, pressure pipes.',
      sections: [
        { clause: '4.0', heading: 'Materials', snippet: 'PVC compound shall comply with IS 10151; no hazardous additives affecting potability of water.' },
        { clause: '5.2', heading: 'Hydraulic Pressure Test', snippet: 'Pipes shall withstand hydrostatic pressure for 1 hour without failure at 2× working pressure at 20°C.' },
        { clause: '6.1', heading: 'Dimensions', snippet: 'Outside diameter tolerances as per Table 1; wall thickness tolerances ±0.3mm for Class 2 pipes.' },
        { clause: '8.0', heading: 'Marking', snippet: 'Each pipe shall be marked with IS 4985, class, nominal diameter, manufacturer code, and BIS mark.' },
      ],
      applicability: 'Mandatory BIS certification for uPVC pipes used in potable water distribution. Applies to all pressure classes (Class 2, 4, 6) sold in India.',
      source: 'https://www.bis.gov.in/product/IS4985'
    },
    {
      is: 'IS 6608', title: 'Skin Cosmetics — Creams, Lotions and Powders',
      scope: 'Face cream, moisturizer, skin lotion, body powder, cosmetic cream, herbal cream for skin application.',
      sections: [
        { clause: '4.1', heading: 'Stability', snippet: 'Product shall be stable at 45°C for 28 days without phase separation, rancidity or change in odour.' },
        { clause: '5.0', heading: 'Microbiological Limits', snippet: 'Total aerobic count ≤1000 CFU/g; E.coli, S.aureus, Pseudomonas — absent per gram.' },
        { clause: '6.0', heading: 'Restricted Substances', snippet: 'Shall not contain mercury, lead >10ppm, arsenic >5ppm, or any prohibited ingredient per BIS list.' },
        { clause: '7.0', heading: 'pH Range', snippet: 'pH of finished product shall be between 4.5 and 8.5 when tested as 10% aqueous dispersion.' },
      ],
      applicability: 'Voluntary standard for skin creams and lotions. Compliance with IS 6608 demonstrates quality and supports regulatory submissions under Drugs & Cosmetics Act.',
      source: 'https://www.bis.gov.in/product/IS6608'
    },
    {
      is: 'IS 4246', title: 'Cosmetic Products — Labelling and Packaging',
      scope: 'Cosmetics, beauty products, skincare, personal care items — labelling and packaging requirements.',
      sections: [
        { clause: '4.1', heading: 'Mandatory Label Information', snippet: 'Label shall contain: product name, ingredients (INCI), net quantity, manufacturer name and address, MRP, MFG date, best before date, and batch number.' },
        { clause: '5.0', heading: 'Ingredient Declaration', snippet: 'All ingredients shall be listed in descending order of weight; water listed as Aqua; fragrance as Parfum.' },
        { clause: '6.0', heading: 'Cautionary Statements', snippet: 'Products for specific use (hair dye, exfoliants) shall carry appropriate cautionary statements as per Schedule.' },
      ],
      applicability: 'Applies to all cosmetic products sold in India. Mandatory under Legal Metrology Act for net quantity declarations; aligns with Drugs & Cosmetics Rules.',
      source: 'https://www.bis.gov.in/product/IS4246'
    },
    {
      is: 'IS 277', title: 'Galvanized Steel Sheets — Plain and Corrugated',
      scope: 'GI sheet, galvanized iron sheet, corrugated roofing sheet, zinc-coated steel for roofing and cladding.',
      sections: [
        { clause: '4.1', heading: 'Zinc Coating Mass', snippet: 'Minimum zinc coating mass 275 g/m² (total both sides) for Z275 grade used in roofing applications.' },
        { clause: '5.0', heading: 'Adhesion Test', snippet: 'Coating shall not flake or crack when bent 180° over a mandrel equal to the sheet thickness.' },
        { clause: '6.0', heading: 'Dimensions', snippet: 'Standard widths 900mm and 1200mm; length tolerances ±6mm; thickness tolerance ±0.05mm.' },
      ],
      applicability: 'Mandatory BIS certification for GI sheets. Applies to manufacturers of corrugated roofing sheets, plain GI sheets for construction and industrial use in India.',
      source: 'https://www.bis.gov.in/product/IS277'
    },
    {
      is: 'IS 8112', title: 'Ordinary Portland Cement 43 Grade',
      scope: 'OPC cement, 43 grade cement, construction cement for buildings and infrastructure.',
      sections: [
        { clause: '5.1', heading: 'Fineness', snippet: 'Specific surface area ≥225 m²/kg by Blaine air permeability method.' },
        { clause: '5.3', heading: 'Compressive Strength', snippet: '43 MPa minimum at 28 days; 23 MPa at 7 days; 16 MPa at 3 days.' },
        { clause: '5.4', heading: 'Soundness', snippet: 'Le Chatelier expansion max 10mm; autoclave expansion max 0.8%.' },
        { clause: '6.0', heading: 'Setting Time', snippet: 'Initial setting time not less than 30 minutes; final setting time not more than 600 minutes.' },
      ],
      applicability: 'Mandatory BIS certification for OPC 43 Grade cement. All cement bags sold in India must carry ISI mark. Applies to manufacturers and importers.',
      source: 'https://www.bis.gov.in/product/IS8112'
    },
    {
      is: 'IS 694', title: 'PVC Insulated Cables for Working Voltages up to 1100V',
      scope: 'Electrical wire, PVC cable, domestic wiring cable, copper conductor cable for building wiring.',
      sections: [
        { clause: '4.0', heading: 'Conductor', snippet: 'Conductors shall be annealed copper conforming to IS 8130; stranded construction for cross sections above 4mm².' },
        { clause: '6.1', heading: 'Insulation Thickness', snippet: 'Minimum insulation thickness 0.6mm for 1.0mm² conductors; 0.8mm for 2.5mm² per Table 2.' },
        { clause: '8.0', heading: 'Voltage Test', snippet: 'Cable shall withstand 3.5kV AC for 5 minutes without breakdown on finished cable.' },
        { clause: '10.0', heading: 'Flammability', snippet: 'Single cable vertical flame propagation test per IEC 60332-1; cable shall self-extinguish within 60 seconds.' },
      ],
      applicability: 'Mandatory BIS certification for PVC insulated wires and cables used in building wiring in India. All electrical cables must carry ISI mark per CRS.',
      source: 'https://www.bis.gov.in/product/IS694'
    },
    {
      is: 'IS 1489', title: 'Portland Pozzolana Cement (Fly Ash Based)',
      scope: 'PPC cement, blended cement, fly ash cement, concrete binder for general construction.',
      sections: [
        { clause: '4.1', heading: 'Fly Ash Content', snippet: 'Fly ash content shall be between 15% and 35% by mass of Portland pozzolana cement.' },
        { clause: '5.2', heading: 'Compressive Strength', snippet: 'Minimum 33 MPa at 28 days; 16 MPa at 7 days.' },
        { clause: '6.0', heading: 'Fineness', snippet: 'Specific surface area ≥300 m²/kg; fly ash content verified by chemical analysis.' },
      ],
      applicability: 'Mandatory BIS certification for PPC cement. Widely used alternative to OPC; all PPC sold in India requires ISI mark.',
      source: 'https://www.bis.gov.in/product/IS1489'
    },
    {
      is: 'IS 14890', title: 'Soaps — Toilet Soaps',
      scope: 'Toilet soaps, beauty bars, handwash bars, bathing soap for personal hygiene.',
      sections: [
        { clause: '4.1', heading: 'Total Fatty Matter (TFM)', snippet: 'Grade 1: TFM ≥76%; Grade 2: TFM ≥70%; Grade 3: TFM ≥60%. TFM determines soap quality grade.' },
        { clause: '5.0', heading: 'Moisture', snippet: 'Moisture and volatile matter shall not exceed 15% for Grade 1 soaps.' },
        { clause: '6.0', heading: 'Free Caustic Alkali', snippet: 'Free caustic alkali (as NaOH) shall not exceed 0.1% to prevent skin irritation.' },
        { clause: '8.0', heading: 'Prohibited Substances', snippet: 'Soap shall not contain prohibited colorants, mercury compounds, or undeclared active ingredients.' },
      ],
      applicability: 'Voluntary BIS standard but widely referenced by retailers and export buyers. TFM grade must be declared on label per BIS and Legal Metrology rules.',
      source: 'https://www.bis.gov.in/product/IS14890'
    },
    {
      is: 'IS 15549', title: 'Hand Sanitizer — Requirements',
      scope: 'Hand sanitiser, alcohol-based hand rub, hand disinfectant, antiseptic gel.',
      sections: [
        { clause: '4.1', heading: 'Alcohol Content', snippet: 'Ethanol content 60–85% v/v OR isopropanol 60–75% v/v; shall be tested by GC method per IS 6582.' },
        { clause: '5.0', heading: 'Microbial Kill Rate', snippet: 'Shall achieve ≥3 log10 reduction of E.coli and S.aureus within 30 seconds (EN 1500 test).' },
        { clause: '6.0', heading: 'pH', snippet: 'pH shall be between 5.0 and 8.0 to prevent skin damage and maintain stability.' },
        { clause: '7.0', heading: 'Labelling', snippet: 'Label must mention alcohol type and %, "For external use only", batch number, MFG/EXP date.' },
      ],
      applicability: 'Applicable to manufacturers of alcohol-based hand sanitizers sold in India. BIS certification mandatory under CRS since 2020 for retail sale.',
      source: 'https://www.bis.gov.in/product/IS15549'
    },
    {
      is: 'IS 1367', title: 'Technical Supply Conditions for Threaded Steel Fasteners',
      scope: 'Bolts, screws, nuts, washers, mechanical fasteners for general engineering.',
      sections: [
        { clause: '4.0', heading: 'Property Classes', snippet: 'Bolts and screws in property classes 3.6, 4.6, 4.8, 5.6, 5.8, 6.8, 8.8, 9.8, 10.9, 12.9.' },
        { clause: '6.1', heading: 'Proof Load', snippet: 'Proof load stress for class 8.8 bolts: 600 MPa; class 10.9: 830 MPa as per Table 5.' },
        { clause: '8.0', heading: 'Surface Defects', snippet: 'Fasteners shall be free from seams, laps, cracks, bursts, and shall conform to IS 6157 surface quality.' },
      ],
      applicability: 'Applicable to manufacturers and suppliers of threaded fasteners in India. IS mark mandatory for fasteners used in critical structural applications.',
      source: 'https://www.bis.gov.in/product/IS1367'
    },
    {
      is: 'IS 383', title: 'Coarse and Fine Aggregates from Natural Sources for Concrete',
      scope: 'Sand, gravel, stone aggregate, crushed stone for concrete mixing.',
      sections: [
        { clause: '4.1', heading: 'Grading Zones', snippet: 'Fine aggregate graded in 4 zones (Zone I coarsest to Zone IV finest); grading limits per Table 4.' },
        { clause: '5.0', heading: 'Deleterious Materials', snippet: 'Clay lumps max 1% by weight; organic impurities tested by colorimetric method per IS 2386 Part II.' },
        { clause: '6.0', heading: 'Alkali-Silica Reactivity', snippet: 'Aggregate shall be tested for ASR if used in mass concrete; expansion shall not exceed 0.1% at 6 months.' },
      ],
      applicability: 'Applicable to aggregate producers and ready-mix concrete suppliers in India. Conformance required for construction projects funded by government and banks.',
      source: 'https://www.bis.gov.in/product/IS383'
    },
    {
      is: 'IS 940', title: 'Portable Fire Extinguisher (CO2 Type)',
      scope: 'CO2 fire extinguisher, portable fire suppression equipment.',
      sections: [
        { clause: '4.0', heading: 'Cylinder Design', snippet: 'Cylinder shall be designed for test pressure 250 bar; seamless steel per IS 7285 or equivalent.' },
        { clause: '6.0', heading: 'Discharge Time', snippet: 'Not less than 8 seconds and not more than 30 seconds for 2kg capacity; pro-rated for other sizes.' },
        { clause: '8.0', heading: 'Hydrostatic Test', snippet: 'Every cylinder hydrostatically tested at 250 bar for 1 minute before filling; test date stamped.' },
      ],
      applicability: 'Mandatory BIS certification for CO2 fire extinguishers. Required under National Building Code and factory safety regulations for commercial premises.',
      source: 'https://www.bis.gov.in/product/IS940'
    },
  ];

  // ─── INIT ─────────────────────────────────────────────────────────────────
  function init() {
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

  function fillExample(text) {
    const ta = document.getElementById('productInput');
    ta.value = text;
    ta.dispatchEvent(new Event('input'));
    ta.focus();
    document.getElementById('demo').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ─── LOCAL RETRIEVAL ──────────────────────────────────────────────────────
  function localRetrieve(query, category, k = 8) {
    const stopWords = new Set(['for','the','in','a','an','to','of','and','or','with','is','are','that','this','by','on','at','be','as','from','my','i','its','it','we','you','sold','used','use','build','make','manufacture','india']);
    const tokens = tokenize(query + ' ' + category).filter(t => !stopWords.has(t));
    return BIS_CATALOG
      .map(std => {
        const corpus = tokenize(std.title + ' ' + std.scope + ' ' + std.sections.map(s => s.snippet).join(' '));
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

  // ─── CORE: CALL VERCEL PROXY ──────────────────────────────────────────────
  async function callLLM(productDescription, category, retrievedDocs) {

    const contextBlock = retrievedDocs.map((d, i) => {
      const clauseList = d.sections.map(s =>
        `  Clause ${s.clause} — ${s.heading}: "${s.snippet}"`
      ).join('\n');
      return `[DOC ${i+1}]
IS Number: ${d.is}
Title: ${d.title}
Scope: ${d.scope}
Key Sections & Clauses:
${clauseList}
Applicability: ${d.applicability}
Source: ${d.source}`;
    }).join('\n\n');

    const systemPrompt = `You are a highly specialised BIS (Bureau of Indian Standards) compliance expert for Indian Micro and Small Enterprises (MSEs).

TASK: Analyse the product description and return the most applicable BIS standards with detailed clause-level information from the CONTEXT DOCUMENTS ONLY.

STRICT RULES:
1. ONLY use IS numbers, titles, clause numbers and snippets from the CONTEXT DOCUMENTS. Never invent anything.
2. Return EXACTLY 3 to 5 recommendations ranked by relevance (most relevant first).
3. For each result, select the 2-3 most relevant clauses from the document's sections.
4. Output ONLY a valid JSON array — no preamble, no markdown fences, no explanation outside JSON.
5. Write all text fields in plain English for a non-technical business owner.

OUTPUT FORMAT (return this exact JSON structure):
[
  {
    "rank": 1,
    "is_number": "IS XXXX",
    "title": "Exact title from context",
    "relevance_score": 92,
    "why_applicable": "2-3 sentences explaining specifically why this standard applies to this exact product.",
    "relevant_clauses": [
      {
        "clause": "5.1",
        "heading": "Clause heading",
        "snippet": "Exact snippet from context",
        "relevance_to_product": "One sentence on why this clause matters for this specific product."
      }
    ],
    "applicability_paragraph": "Full applicability paragraph from context explaining who must comply and under what scheme.",
    "mandatory": true,
    "source": "https://www.bis.gov.in/product/ISXXXX"
  }
]`;

    const userPrompt = `PRODUCT DESCRIPTION: "${productDescription}"
PRODUCT CATEGORY: ${category || 'Auto-detect from description'}

CONTEXT DOCUMENTS (use ONLY these — every clause number and snippet must come from here):
${contextBlock}

Return the JSON array only. No other text.`;

    const response = await fetch(CONFIG.endpoint, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
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
      throw new Error(err?.error?.message || `Server error: HTTP ${response.status}`);
    }

    const data = await response.json();
    const raw  = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty response. Please try again.');

    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match   = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Could not parse response. Please try again.');
    try {
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) throw new Error('Unexpected response format.');
      return parsed;
    } catch {
      throw new Error('Could not parse model output. Please try again.');
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

    setLoading(true);
    hideError();
    showSkeletonResults();

    const t0 = performance.now();
    try {
      const retrieved = localRetrieve(description, category, 8);
      if (retrieved.length === 0) throw new Error('No relevant BIS standards found. Try a more specific description.');
      const results = await callLLM(description, category, retrieved);
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
        <div class="skeleton-line long"></div>
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
      const score   = typeof r.relevance_score === 'number' ? r.relevance_score : 75;
      const clauses = Array.isArray(r.relevant_clauses) ? r.relevant_clauses : [];
      const isMand  = r.mandatory === true;
      const delay   = i * 0.1;
      const sourceUrl = r.source || `https://www.bis.gov.in`;
      const sourceLabel = r.source ? r.source.replace('https://www.bis.gov.in/product/', 'bis.gov.in › ') : 'bis.gov.in';

      const clauseHTML = clauses.map(c => `
        <div class="clause-item">
          <div class="clause-header">
            <span class="clause-num">§ ${escHtml(c.clause || '')}</span>
            <span class="clause-heading">${escHtml(c.heading || '')}</span>
          </div>
          <p class="clause-snippet">"${escHtml(c.snippet || '')}"</p>
          ${c.relevance_to_product ? `<p class="clause-relevance">↳ ${escHtml(c.relevance_to_product)}</p>` : ''}
        </div>`).join('');

      return `
        <div class="result-card" style="animation-delay:${delay}s">

          <!-- HEADER ROW -->
          <div class="card-header-row">
            <div class="card-badges">
              <span class="badge-is">${escHtml(r.is_number || 'IS ???')}</span>
              <span class="badge-rank">Rank #${r.rank || (i+1)}</span>
              ${isMand ? '<span class="badge-mandatory">MANDATORY</span>' : '<span class="badge-voluntary">VOLUNTARY</span>'}
            </div>
            <div class="relevance-block">
              <span class="relevance-label">Relevance</span>
              <div class="relevance-bar-wrap"><div class="relevance-bar" style="width:${score}%"></div></div>
              <span class="relevance-pct">${score}%</span>
            </div>
          </div>

          <!-- TITLE -->
          <h3 class="card-title">${escHtml(r.title || 'Untitled Standard')}</h3>

          <!-- WHY APPLICABLE -->
          <div class="card-section">
            <div class="section-label-row">
              <span class="section-icon">🎯</span>
              <span class="section-label">Why Applicable</span>
            </div>
            <p class="section-body">${escHtml(r.why_applicable || '')}</p>
          </div>

          <!-- RELEVANT CLAUSES -->
          ${clauses.length ? `
          <div class="card-section">
            <div class="section-label-row">
              <span class="section-icon">📐</span>
              <span class="section-label">Relevant Sections & Clause Snippets</span>
            </div>
            <div class="clauses-list">${clauseHTML}</div>
          </div>` : ''}

          <!-- APPLICABILITY PARAGRAPH -->
          ${r.applicability_paragraph ? `
          <div class="card-section">
            <div class="section-label-row">
              <span class="section-icon">📋</span>
              <span class="section-label">Applicability</span>
            </div>
            <p class="section-body applicability-para">${escHtml(r.applicability_paragraph)}</p>
          </div>` : ''}

          <!-- SOURCE -->
          <div class="card-source">
            <span class="source-icon">🔗</span>
            <span class="source-label">Source:</span>
            <a href="${sourceUrl}" target="_blank" rel="noopener" class="source-link">${sourceLabel}</a>
          </div>

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

  function exportResults() {
    if (!lastResults) return;
    const blob = new Blob([JSON.stringify(lastResults, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `bis-standards-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return { init, analyze, fillExample, exportResults };
})();

document.addEventListener('DOMContentLoaded', app.init);