// Curated supply-chain links for widely traded names, from public filings and reporting (as of 2026).
// There is no free live supply-chain feed (Bloomberg SPLC / FactSet Revere are paid), so this is a
// hand-kept map: extend it as needed. A null ticker means the company is private or not US-listed.

export type Link = [ticker: string | null, name: string, role: string];
export interface Topology { suppliers: Link[]; customers: Link[]; competitors: Link[] }

const T = (suppliers: Link[], customers: Link[], competitors: Link[]): Topology => ({ suppliers, customers, competitors });

export const SUPPLY_CHAIN: Record<string, Topology> = {
  NVDA: T(
    [["TSM", "TSMC", "Wafers + CoWoS packaging"], ["SKHY", "SK hynix", "HBM memory"], ["MU", "Micron", "HBM memory"], [null, "Samsung", "HBM memory"], ["AMKR", "Amkor", "Packaging & test"], [null, "Foxconn", "Server assembly"]],
    [["MSFT", "Microsoft", "Azure AI clusters"], ["META", "Meta", "AI training"], ["AMZN", "Amazon", "AWS GPUs"], ["GOOGL", "Alphabet", "Google Cloud"], ["ORCL", "Oracle", "OCI AI capacity"], ["DELL", "Dell", "AI servers"], ["SMCI", "Supermicro", "AI servers"], ["CRWV", "CoreWeave", "GPU cloud"]],
    [["AMD", "AMD", "Instinct GPUs"], ["AVGO", "Broadcom", "Custom AI ASICs"], ["INTC", "Intel", "Gaudi / data center"], ["GOOGL", "Alphabet", "TPU"]],
  ),
  AMD: T(
    [["TSM", "TSMC", "Wafer fabrication"], ["MU", "Micron", "HBM memory"], [null, "Samsung", "HBM memory"], ["AMKR", "Amkor", "Packaging"], ["ASX", "ASE Technology", "Packaging & test"]],
    [["MSFT", "Microsoft", "Azure + Xbox chips"], ["META", "Meta", "Instinct GPUs"], ["ORCL", "Oracle", "MI-series clusters"], ["SONY", "Sony", "PlayStation chips"], ["DELL", "Dell", "PCs & servers"], ["HPQ", "HP", "PCs"]],
    [["NVDA", "NVIDIA", "AI GPUs"], ["INTC", "Intel", "x86 CPUs"], ["ARM", "Arm", "CPU architecture"], ["QCOM", "Qualcomm", "PC chips"]],
  ),
  AAPL: T(
    [["TSM", "TSMC", "A- and M-series chips"], [null, "Foxconn", "iPhone assembly"], ["AVGO", "Broadcom", "Wireless chips"], ["QCOM", "Qualcomm", "Modems"], ["SWKS", "Skyworks", "RF chips"], ["GLW", "Corning", "Cover glass"], ["SONY", "Sony", "Camera sensors"], ["MU", "Micron", "Memory"]],
    [["VZ", "Verizon", "Carrier sales"], ["T", "AT&T", "Carrier sales"], ["TMUS", "T-Mobile", "Carrier sales"], ["BBY", "Best Buy", "Retail"]],
    [[null, "Samsung", "Smartphones"], ["GOOGL", "Alphabet", "Android / Pixel"], ["MSFT", "Microsoft", "PCs & software"]],
  ),
  MSFT: T(
    [["NVDA", "NVIDIA", "AI GPUs"], ["AMD", "AMD", "AI GPUs + CPUs"], ["INTC", "Intel", "Server CPUs"], ["ANET", "Arista", "Data-center networking"], ["VRT", "Vertiv", "Power & cooling"], ["CRWV", "CoreWeave", "Leased GPU capacity"]],
    [[null, "OpenAI", "Azure compute partner"], [null, "Enterprises & government", "Cloud + Office"]],
    [["AMZN", "Amazon", "AWS"], ["GOOGL", "Alphabet", "Google Cloud"], ["ORCL", "Oracle", "Cloud"], ["CRM", "Salesforce", "Business software"]],
  ),
  AMZN: T(
    [["NVDA", "NVIDIA", "AI GPUs"], ["MRVL", "Marvell", "Custom chips (Trainium)"], ["AMD", "AMD", "Server CPUs/GPUs"], ["INTC", "Intel", "Server CPUs"], ["UPS", "UPS", "Parcel delivery"]],
    [[null, "Anthropic", "AWS AI partner"], ["NFLX", "Netflix", "AWS customer"], [null, "Third-party sellers", "Marketplace"]],
    [["WMT", "Walmart", "Retail"], ["MSFT", "Microsoft", "Cloud"], ["GOOGL", "Alphabet", "Cloud + ads"], ["SHOP", "Shopify", "E-commerce"], ["PDD", "PDD (Temu)", "E-commerce"]],
  ),
  GOOGL: T(
    [["AVGO", "Broadcom", "TPU co-design"], ["TSM", "TSMC", "Chip fabrication"], ["NVDA", "NVIDIA", "Cloud GPUs"], ["CLS", "Celestica", "Server hardware"], ["MU", "Micron", "Memory"]],
    [[null, "Advertisers", "Search + YouTube ads"], ["AAPL", "Apple", "Default search deal"], [null, "Anthropic", "Cloud TPU customer"]],
    [["META", "Meta", "Digital ads"], ["MSFT", "Microsoft", "Cloud + AI"], ["AMZN", "Amazon", "Cloud + ads"], [null, "OpenAI", "AI assistants"]],
  ),
  META: T(
    [["NVDA", "NVIDIA", "AI GPUs"], ["AMD", "AMD", "AI GPUs"], ["AVGO", "Broadcom", "MTIA custom chips"], ["ANET", "Arista", "Networking"], ["CLS", "Celestica", "Server hardware"], ["QCOM", "Qualcomm", "Quest / glasses chips"]],
    [[null, "Advertisers", "Facebook + Instagram ads"]],
    [["GOOGL", "Alphabet", "Digital ads"], ["SNAP", "Snap", "Social"], ["PINS", "Pinterest", "Social"], ["RDDT", "Reddit", "Social"], [null, "TikTok", "Short video"]],
  ),
  TSLA: T(
    [["PCRFY", "Panasonic", "Battery cells"], [null, "CATL", "LFP cells"], [null, "LG Energy Solution", "Battery cells"], ["NVDA", "NVIDIA", "AI training compute"], ["ALB", "Albemarle", "Lithium"], [null, "Samsung", "AI chips (fab)"]],
    [[null, "Consumers", "EVs"], [null, "Utilities", "Megapack storage"]],
    [["BYDDY", "BYD", "EVs"], ["RIVN", "Rivian", "EVs"], ["GM", "General Motors", "EVs"], ["F", "Ford", "EVs"], ["GOOGL", "Waymo (Alphabet)", "Robotaxi"]],
  ),
  AVGO: T(
    [["TSM", "TSMC", "Wafer fabrication"], ["AMKR", "Amkor", "Packaging"], ["ASX", "ASE Technology", "Packaging & test"]],
    [["GOOGL", "Alphabet", "TPU partner"], ["META", "Meta", "Custom AI chips"], ["AAPL", "Apple", "Wireless chips"], [null, "OpenAI", "Custom AI chips"]],
    [["MRVL", "Marvell", "Custom silicon"], ["NVDA", "NVIDIA", "AI networking"], ["AMD", "AMD", "AI accelerators"]],
  ),
  TSM: T(
    [["ASML", "ASML", "EUV lithography"], ["AMAT", "Applied Materials", "Deposition/etch"], ["LRCX", "Lam Research", "Etch"], ["KLAC", "KLA", "Inspection"], ["ENTG", "Entegris", "Materials"]],
    [["AAPL", "Apple", "Largest customer"], ["NVDA", "NVIDIA", "AI GPUs"], ["AMD", "AMD", "CPUs/GPUs"], ["AVGO", "Broadcom", "ASICs"], ["QCOM", "Qualcomm", "Mobile chips"], ["INTC", "Intel", "Outsourced tiles"]],
    [[null, "Samsung Foundry", "Foundry"], ["INTC", "Intel Foundry", "Foundry"], ["GFS", "GlobalFoundries", "Foundry"], ["UMC", "UMC", "Foundry"]],
  ),
  INTC: T(
    [["ASML", "ASML", "Lithography"], ["AMAT", "Applied Materials", "Fab tools"], ["LRCX", "Lam Research", "Etch"], ["TSM", "TSMC", "Outsourced chip tiles"]],
    [["DELL", "Dell", "PCs & servers"], ["HPQ", "HP", "PCs"], ["LNVGY", "Lenovo", "PCs"], ["AMZN", "Amazon", "AWS CPUs"]],
    [["AMD", "AMD", "x86 CPUs"], ["NVDA", "NVIDIA", "Data center"], ["ARM", "Arm", "CPU architecture"], ["TSM", "TSMC", "Foundry"]],
  ),
  MU: T(
    [["ASML", "ASML", "Lithography"], ["AMAT", "Applied Materials", "Fab tools"], ["LRCX", "Lam Research", "Etch"], ["KLAC", "KLA", "Inspection"]],
    [["NVDA", "NVIDIA", "HBM for AI GPUs"], ["AMD", "AMD", "HBM"], ["AAPL", "Apple", "Mobile memory"], ["DELL", "Dell", "PC/server memory"]],
    [[null, "Samsung", "DRAM / HBM"], ["SKHY", "SK hynix", "DRAM / HBM"], ["SNDK", "Sandisk", "NAND"]],
  ),
  SNDK: T(
    [[null, "Kioxia", "NAND fab joint venture"], ["AMAT", "Applied Materials", "Fab tools"], ["LRCX", "Lam Research", "Etch"]],
    [["AAPL", "Apple", "Flash storage"], ["DELL", "Dell", "SSDs"], ["HPQ", "HP", "SSDs"], [null, "Hyperscalers", "Enterprise SSDs"]],
    [["MU", "Micron", "NAND"], [null, "Samsung", "NAND"], ["SKHY", "SK hynix", "NAND"]],
  ),
  ASML: T(
    [[null, "Carl Zeiss SMT", "EUV optics"], [null, "TRUMPF", "EUV lasers"]],
    [["TSM", "TSMC", "EUV tools"], [null, "Samsung", "EUV tools"], ["INTC", "Intel", "EUV tools"], ["MU", "Micron", "DRAM tools"], ["SKHY", "SK hynix", "DRAM tools"]],
    [["CAJPY", "Canon", "Lithography"], ["NINOY", "Nikon", "Lithography"]],
  ),
  ARM: T(
    [[null, "SoftBank", "Majority owner"]],
    [["AAPL", "Apple", "Architecture license"], ["NVDA", "NVIDIA", "Grace CPUs"], ["QCOM", "Qualcomm", "Mobile CPUs"], ["AMZN", "Amazon", "Graviton"], ["GOOGL", "Alphabet", "Axion"], ["MSFT", "Microsoft", "Cobalt"]],
    [["INTC", "Intel", "x86"], ["AMD", "AMD", "x86"], [null, "RISC-V", "Open architecture"]],
  ),
  QCOM: T(
    [["TSM", "TSMC", "Fabrication"], [null, "Samsung", "Fabrication"], ["AMKR", "Amkor", "Packaging"]],
    [["AAPL", "Apple", "Modems (winding down)"], [null, "Samsung", "Snapdragon"], [null, "Xiaomi", "Snapdragon"], ["META", "Meta", "XR chips"]],
    [[null, "MediaTek", "Mobile SoCs"], ["AVGO", "Broadcom", "Wireless"], ["ARM", "Arm", "Licensing"]],
  ),
  SMCI: T(
    [["NVDA", "NVIDIA", "GPUs"], ["AMD", "AMD", "GPUs/CPUs"], ["INTC", "Intel", "CPUs"], ["MU", "Micron", "Memory"]],
    [[null, "xAI", "AI clusters"], ["CRWV", "CoreWeave", "GPU cloud"], [null, "Tier-2 clouds", "AI servers"]],
    [["DELL", "Dell", "AI servers"], ["HPE", "HPE", "AI servers"]],
  ),
  DELL: T(
    [["NVDA", "NVIDIA", "GPUs"], ["INTC", "Intel", "CPUs"], ["AMD", "AMD", "CPUs"], ["MU", "Micron", "Memory"], [null, "Foxconn", "Assembly"]],
    [[null, "xAI", "AI servers"], ["CRWV", "CoreWeave", "AI servers"], [null, "Enterprises", "PCs & servers"]],
    [["HPQ", "HP", "PCs"], ["HPE", "HPE", "Servers"], ["SMCI", "Supermicro", "AI servers"], ["LNVGY", "Lenovo", "PCs"]],
  ),
  CRWV: T(
    [["NVDA", "NVIDIA", "GPUs (also investor)"], ["DELL", "Dell", "Servers"], ["SMCI", "Supermicro", "Servers"]],
    [["MSFT", "Microsoft", "Capacity contracts"], [null, "OpenAI", "Compute contracts"], ["META", "Meta", "Compute contract"]],
    [["AMZN", "AWS", "Cloud"], ["ORCL", "Oracle", "Cloud"], ["NBIS", "Nebius", "GPU cloud"]],
  ),
  ORCL: T(
    [["NVDA", "NVIDIA", "AI GPUs"], ["AMD", "AMD", "AI GPUs"]],
    [[null, "OpenAI", "Stargate capacity"], ["META", "Meta", "Cloud capacity"], [null, "Enterprises", "Database + apps"]],
    [["MSFT", "Microsoft", "Cloud"], ["AMZN", "Amazon", "Cloud"], ["GOOGL", "Alphabet", "Cloud"], ["SAP", "SAP", "Enterprise apps"]],
  ),
  NFLX: T(
    [["AMZN", "AWS", "Streaming infrastructure"], [null, "Studios & creators", "Licensed content"]],
    [[null, "Subscribers", "Streaming"], [null, "Advertisers", "Ad tier"]],
    [["DIS", "Disney", "Streaming"], ["WBD", "Warner Bros. Discovery", "Streaming"], ["AMZN", "Prime Video", "Streaming"], ["GOOGL", "YouTube", "Video"]],
  ),
  V: T(
    [[null, "Card-issuing banks", "Issue Visa cards"]],
    [["JPM", "JPMorgan", "Issuer"], ["BAC", "Bank of America", "Issuer"], ["C", "Citigroup", "Issuer"], ["COF", "Capital One", "Issuer"]],
    [["MA", "Mastercard", "Card network"], ["AXP", "American Express", "Card network"], ["PYPL", "PayPal", "Payments"]],
  ),
  MA: T(
    [[null, "Card-issuing banks", "Issue Mastercard cards"]],
    [["JPM", "JPMorgan", "Issuer"], ["C", "Citigroup", "Issuer"], ["COF", "Capital One", "Issuer"]],
    [["V", "Visa", "Card network"], ["AXP", "American Express", "Card network"], ["PYPL", "PayPal", "Payments"]],
  ),
  WMT: T(
    [["PG", "Procter & Gamble", "Household goods"], ["KO", "Coca-Cola", "Beverages"], ["PEP", "PepsiCo", "Food & beverages"], ["GIS", "General Mills", "Food"], ["KMB", "Kimberly-Clark", "Paper goods"]],
    [[null, "Consumers", "Retail"]],
    [["AMZN", "Amazon", "Retail"], ["COST", "Costco", "Warehouse clubs"], ["TGT", "Target", "Retail"], ["KR", "Kroger", "Grocery"]],
  ),
  COST: T(
    [["PG", "Procter & Gamble", "Household goods"], ["KO", "Coca-Cola", "Beverages"], ["PEP", "PepsiCo", "Food & beverages"], ["TSN", "Tyson Foods", "Meat"]],
    [[null, "Members", "Warehouse retail"]],
    [["WMT", "Walmart / Sam's Club", "Warehouse clubs"], ["BJ", "BJ's Wholesale", "Warehouse clubs"], ["AMZN", "Amazon", "Retail"], ["TGT", "Target", "Retail"]],
  ),
  KO: T(
    [["BALL", "Ball", "Aluminum cans"], ["ADM", "ADM", "Sweeteners"], ["INGR", "Ingredion", "Sweeteners"]],
    [["COKE", "Coca-Cola Consolidated", "Bottler"], ["KOF", "Coca-Cola FEMSA", "Bottler"], ["CCEP", "Coca-Cola Europacific", "Bottler"], ["MCD", "McDonald's", "Fountain"], ["WMT", "Walmart", "Retail"]],
    [["PEP", "PepsiCo", "Beverages"], ["KDP", "Keurig Dr Pepper", "Beverages"], ["MNST", "Monster", "Energy drinks"]],
  ),
  BA: T(
    [["GE", "GE Aerospace", "Engines (CFM)"], ["RTX", "RTX", "Engines & avionics"], ["HWM", "Howmet", "Engine parts"], ["HXL", "Hexcel", "Composites"], [null, "Spirit AeroSystems", "Fuselages"]],
    [["DAL", "Delta", "Airline"], ["UAL", "United", "Airline"], ["AAL", "American", "Airline"], ["LUV", "Southwest", "Airline"], ["RYAAY", "Ryanair", "Airline"]],
    [["EADSY", "Airbus", "Commercial jets"], ["EMBJ", "Embraer", "Regional jets"]],
  ),
  CAT: T(
    [["NUE", "Nucor", "Steel"], ["CMI", "Cummins", "Engines & parts"]],
    [["FCX", "Freeport-McMoRan", "Mining fleet"], ["BHP", "BHP", "Mining fleet"], ["RIO", "Rio Tinto", "Mining fleet"], ["URI", "United Rentals", "Rental fleet"]],
    [["DE", "Deere", "Heavy equipment"], ["KMTUY", "Komatsu", "Heavy equipment"], ["VOLVY", "Volvo", "Construction equipment"]],
  ),
  LLY: T(
    [["TMO", "Thermo Fisher", "Contract manufacturing"], ["WST", "West Pharmaceutical", "Injectable components"], ["BDX", "Becton Dickinson", "Pens & syringes"]],
    [["MCK", "McKesson", "Distribution"], ["COR", "Cencora", "Distribution"], ["CAH", "Cardinal Health", "Distribution"], ["CVS", "CVS", "PBM / pharmacy"], ["CI", "Cigna (Express Scripts)", "PBM"]],
    [["NVO", "Novo Nordisk", "GLP-1"], ["PFE", "Pfizer", "Pharma"], ["AMGN", "Amgen", "Obesity pipeline"]],
  ),
  XOM: T(
    [["SLB", "SLB", "Oilfield services"], ["HAL", "Halliburton", "Oilfield services"], ["BKR", "Baker Hughes", "Equipment"]],
    [[null, "Refiners & chemicals", "Crude & products"], [null, "Consumers", "Fuel"]],
    [["CVX", "Chevron", "Integrated oil"], ["SHEL", "Shell", "Integrated oil"], ["BP", "BP", "Integrated oil"], ["COP", "ConocoPhillips", "E&P"]],
  ),
  UPS: T(
    [["BA", "Boeing", "Cargo aircraft"], ["GE", "GE Aerospace", "Engines"], [null, "Truck makers", "Delivery fleet"]],
    [["AMZN", "Amazon", "Parcel volume (shrinking)"], [null, "Shippers", "Small & large business"]],
    [["FDX", "FedEx", "Parcel delivery"], ["AMZN", "Amazon Logistics", "Parcel delivery"], [null, "USPS", "Parcel delivery"]],
  ),
};

export const getTopology = (symbol: string): Topology | null => SUPPLY_CHAIN[symbol] ?? null;
