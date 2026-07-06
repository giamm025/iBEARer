import sqlite3
import pandas as pd
import numpy as np
import scipy.stats as stats
import statsmodels.api as sm
import statsmodels.formula.api as smf
import seaborn as sns
import matplotlib.pyplot as plt
import json
import warnings

# Ignoriamo i warning per mantenere l'output pulito
warnings.filterwarnings("ignore")

# ==========================================================================
# 1. PARAMETRI E MAPPATURE DEI POST (0 = Low/Giornalistico, 1 = High/Sensazionalista)
# ==========================================================================

SENSATIONALISM_MAPPING = {
    # FRAMING GIORNALISTICO (0)
    "Caso Epstein: il nome di Silvio Berlusconi appare negli atti ufficiali.": 0,
    "Desecretati i log del jet di Epstein: citato Berlusconi.": 0,
    "Epstein e i legami internazionali: cosa sappiamo su Berlusconi.": 0,
    "Berlusconi e il caso Epstein: facciamo chiarezza sugli atti.": 0,
    "Documenti giudiziari: nuovi dettagli sui rapporti tra Berlusconi ed Epstein.": 0,
    
    # FRAMING SENSAZIONALISTICO (1)
    "🚨 BOMBA: Berlusconi era presente sull'isola di Epstein? La verità nascosta! 🚨": 1,
    "Epstein-Berlusconi: ecco cosa c'era davvero dietro quel viaggio!": 1,
    "SHOCK! La connessione tra il Cavaliere e Epstein è ufficiale!": 1,
    "SCANDALO: Il nome di Berlusconi nella Black List di Epstein! 😱": 1,
    "BERLUSCONI E L'ISOLA DEGLI ORRORI: Le prove che non volevano farti vedere!": 1
}

# ==========================================================================
# 2. ESTRAZIONE DATI DAL DATABASE (SQLite)
# ==========================================================================

def get_telemetry_data(db_path):
    print("🔄 Estrazione dati dal Database...")
    conn = sqlite3.connect(db_path)
    
    query = """
        SELECT p.id AS participant_id, t.event_fqn, t.metadata 
        FROM api_telemetryevent t
        JOIN api_participant p ON t.participant_id = p.id
    """
    df_db = pd.read_sql_query(query, conn)
    conn.close()

    df_db['metadata_parsed'] = df_db['metadata'].apply(lambda x: json.loads(x) if isinstance(x, str) else x)
    
    impressions = []
    clicks = []

    for _, row in df_db.iterrows():
        event = row['event_fqn']
        meta = row['metadata_parsed']
        pid = row['participant_id']

        # Evento: Iniezione
        if event == 'telemetry.events.PostAlteredEvent' and meta.get('action_type') == 'INJECTED':
            title = meta.get('original_title', '').strip()
            if title in SENSATIONALISM_MAPPING:
                impressions.append({
                    'Participant ID': pid,
                    'title': title,
                    'content_sensationalism': SENSATIONALISM_MAPPING[title]
                })

        # Evento: Click
        elif 'ClickOn' in event:
            title = meta.get('title', '').strip()
            if title in SENSATIONALISM_MAPPING:
                clicks.append({
                    'Participant ID': pid,
                    'title': title
                })

    df_impressions = pd.DataFrame(impressions)
    df_clicks = pd.DataFrame(clicks)
    
    if df_impressions.empty:
        raise ValueError("Nessun post iniettato trovato nel DB. Controlla il path o il database.")

    # Aggiungiamo 1 per chi ha cliccato
    if not df_clicks.empty:
        df_clicks['click'] = 1
        df_clicks = df_clicks.drop_duplicates(subset=['Participant ID', 'title'])
        df_behavior = pd.merge(df_impressions, df_clicks, on=['Participant ID', 'title'], how='left')
        df_behavior['click'] = df_behavior['click'].fillna(0).astype(int)
    else:
        df_behavior = df_impressions.copy()
        df_behavior['click'] = 0

    print(f"✅ Trovate {len(df_behavior)} iniezioni nel DB.")
    return df_behavior


# ==========================================================================
# 3. ELABORAZIONE SURVEY (EXCEL)
# ==========================================================================

# MAPPATURA LIKERT (Modifica queste chiavi in minuscolo in base all'esatto testo nel tuo Excel)
AOT_MAPPING = {
    "fortemente in disaccordo": 1,
    "moderatamente in disaccordo": 2,
    "leggermente in disaccordo": 3,
    "leggermente d'accordo": 4,
    "moderatamente d'accordo": 5,
    "fortemente d'accordo": 6
}

def get_col_by_keyword(df, keyword):
    matches = [c for c in df.columns if keyword.lower() in str(c).lower()]
    if matches: return matches[0]
    print("\n[DEBUG] 🚨 COLONNE LETTE DA PANDAS:")
    for idx, col in enumerate(df.columns): print(f"{idx}: {col}")
    raise ValueError(f"❌ ERRORE: Non ho trovato nessuna colonna che contiene la parola chiave: '{keyword}'")

def map_likert_to_numeric(val):
    if pd.isna(val): return np.nan
    val_str = str(val).strip().lower()
    for key, num in AOT_MAPPING.items():
        if key in val_str:
            return num
    return pd.to_numeric(val, errors='coerce') # Fallback se è già un numero

def calculate_survey_scores(excel_path):
    print("🔄 Elaborazione risposte Google Forms e conversione testuale...")
    df_survey = pd.read_excel(excel_path)
    df_scored = pd.DataFrame()
    
    # 1. Participant ID
    pid_col = get_col_by_keyword(df_survey, "Participant ID")
    df_scored['Participant ID'] = df_survey[pid_col].astype(str).str.replace('-', '').str.strip().str.lower()
    
    # 2. Supporto a Berlusconi 
    support_col = get_col_by_keyword(df_survey, "Supporto a Berlusconi")
    df_scored['support'] = pd.to_numeric(df_survey[support_col], errors='coerce')

    # 3. CTB 
    ctb_col = get_col_by_keyword(df_survey, "versione ufficiale")
    df_scored['conspiracy_mindset'] = pd.to_numeric(df_survey[ctb_col], errors='coerce')

    # 4. Media Trust 
    trust_keywords = ["testate giornalistiche nazionali", "social media più popolari"]
    trust_cols = [get_col_by_keyword(df_survey, kw) for kw in trust_keywords]
    for col in trust_cols:
        df_survey[col] = pd.to_numeric(df_survey[col], errors='coerce').replace(99, np.nan)
    df_scored['media_trust'] = df_survey[trust_cols].mean(axis=1, skipna=True)

    # 5. AOT-E (Chiusura Mentale)
    aot_items = [
        ("ignorare le prove che sono in conflitto", False),
        ("convinzioni dovrebbero sempre essere riviste", True),
        ("prendere in considerazione nuove possibilità", True),
        ("lealtà ai propri ideali e principi sia più importante", False),
        ("Nessuno può farmi cambiare idea", False),
        ("troppo importanti per essere abbandonate", False),
        ("prove che vanno contro le loro convinzioni", True),
        ("perseverare nelle proprie convinzioni anche quando", False)
    ]
    
    aot_col_names = []
    for keyword, is_reverse in aot_items:
        col = get_col_by_keyword(df_survey, keyword)
        # PRIMA applichiamo la mappatura testo -> numero
        df_survey[col] = df_survey[col].apply(map_likert_to_numeric)
        
        if is_reverse:
            df_survey[col] = 7 - df_survey[col] 
        aot_col_names.append(col)
            
    df_scored['aot_closed_mindset'] = df_survey[aot_col_names].mean(axis=1, skipna=True)
    return df_scored

# ==========================================================================
# 4. MERGE E ANALISI STATISTICA (SMART DROP-NA)
# ==========================================================================

print("\n--- INIZIO PIPELINE DATI ---")
df_behavior = get_telemetry_data('db.sqlite3')
df_behavior['Participant ID'] = df_behavior['Participant ID'].astype(str).str.replace('-', '').str.strip().str.lower()
df_scores = calculate_survey_scores('Pre-Survey_iBEAREr.xlsx')

df = pd.merge(df_behavior, df_scores, on='Participant ID', how='inner')
print(f"🔗 Merge Definitivo Completato: {len(df)} osservazioni totali da elaborare.\n")

# --- HP1: CHI-QUADRATO SUL CTR (Usa tutto il dataset) ---
print("======================================================")
print("📌 HP1: Impatto del Sensazionalismo sul CTR")
print("======================================================")
contingency_table = pd.crosstab(df['content_sensationalism'], df['click'])
print(contingency_table)
chi2, p_val, dof, expected = stats.chi2_contingency(contingency_table)
print(f"p-value = {p_val:.4f} -> {'SIGNIFICATIVO (Confermata)' if p_val < 0.05 else 'NON Significativo (Rifiutata)'}")

# --- HP2-4: MODELLI LINEARI MISTI GEE (Usa solo i dati non-NaN per ogni modello) ---
print("\n======================================================")
print("📌 HP2-4: Modulazione Psicologica (Modelli GEE)")
print("======================================================")

# HP2
df_hp2 = df.dropna(subset=['support'])
model_hp2 = smf.gee("click ~ support * content_sensationalism", groups="Participant ID", data=df_hp2, family=sm.families.Binomial()).fit()
print(f"\n--- HP2: Supporto a Berlusconi (n={len(df_hp2)}) ---")
print(model_hp2.summary().tables[1])

# HP3
df_hp3 = df.dropna(subset=['media_trust'])
model_hp3 = smf.gee("click ~ media_trust * content_sensationalism", groups="Participant ID", data=df_hp3, family=sm.families.Binomial()).fit()
print(f"\n--- HP3: Fiducia nei Media (n={len(df_hp3)}) ---")
print(model_hp3.summary().tables[1])

# HP4a
df_hp4a = df.dropna(subset=['conspiracy_mindset'])
model_hp4a = smf.gee("click ~ conspiracy_mindset * content_sensationalism", groups="Participant ID", data=df_hp4a, family=sm.families.Binomial()).fit()
print(f"\n--- HP4a: Complottismo CTB (n={len(df_hp4a)}) ---")
print(model_hp4a.summary().tables[1])

# HP4b
df_hp4b = df.dropna(subset=['aot_closed_mindset'])
model_hp4b = smf.gee("click ~ aot_closed_mindset * content_sensationalism", groups="Participant ID", data=df_hp4b, family=sm.families.Binomial()).fit()
print(f"\n--- HP4b: Chiusura Mentale AOT-E (n={len(df_hp4b)}) ---")
print(model_hp4b.summary().tables[1])

sns.set_theme(style="whitegrid")
plt.figure(figsize=(7, 5))
ax = sns.barplot(x='content_sensationalism', y='click', data=df, errorbar=('ci', 95), palette="mako")
plt.title('Impatto del Framing sul Click-Through Rate (CTR)', fontsize=14, pad=15)
plt.xlabel('Tipologia di Framing', fontsize=12)
plt.ylabel('Probabilità Media di Click (CTR)', fontsize=12)
plt.xticks([0, 1], ['Giornalistico / Formale', 'Sensazionalistico'])
plt.ylim(0, max(df['click'].mean() * 2, 1.0))
plt.tight_layout()
plt.show()

# ==========================================================================
# 6. VISUALIZZAZIONE GRAFICA 2: EFFETTI DI MODERAZIONE (Interaction Plots)
# ==========================================================================
print("\nGenerazione dei grafici di interazione (Plot 2)...")

df_plot = df.copy()
df_plot['Framing'] = df_plot['content_sensationalism'].map({0: 'Giornalistico', 1: 'Sensazionalistico'})

# Median split manuale: robusto contro dati fortemente clusterizzati (niente più crash di bin overlapping)
df_plot['Supporto Berlusconi'] = np.where(df_plot['support'] > df_plot['support'].median(), 'Alto', 'Basso')
df_plot['Fiducia Media'] = np.where(df_plot['media_trust'] > df_plot['media_trust'].median(), 'Alta', 'Bassa')
df_plot['Complottismo (CTB)'] = np.where(df_plot['conspiracy_mindset'] > df_plot['conspiracy_mindset'].median(), 'Alto', 'Basso')
df_plot['Chiusura Mentale (AOT)'] = np.where(df_plot['aot_closed_mindset'] > df_plot['aot_closed_mindset'].median(), 'Alta', 'Bassa')

fig, axes = plt.subplots(2, 2, figsize=(12, 10))
fig.suptitle('Effetti di Moderazione Psicologica sul CTR (Interaction Plots)', fontsize=16, y=0.98)

moderators = [
    ('Supporto Berlusconi', axes[0, 0]),
    ('Fiducia Media', axes[0, 1]),
    ('Complottismo (CTB)', axes[1, 0]),
    ('Chiusura Mentale (AOT)', axes[1, 1])
]

for mod_name, ax in moderators:
    sns.pointplot(
        data=df_plot, 
        x='Framing', 
        y='click', 
        hue=mod_name, 
        dodge=True,
        markers=['o', 's'],
        capsize=.1,
        err_kws={'linewidth': 1.5},
        ax=ax,
        palette="Set1"
    )
    ax.set_title(f'Moderazione: {mod_name}', fontsize=12)
    ax.set_ylabel('Probabilità Media di Click (CTR)')
    ax.set_xlabel('')
    ax.set_ylim(0, 1) # Assicura che la scala sia fissa per tutti da 0 a 100%
    ax.grid(True, axis='y', linestyle='--', alpha=0.7)

plt.tight_layout()
plt.show()