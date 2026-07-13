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
from scipy.stats import zscore

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

    # 4. Media Trust: DIVIDIAMO TRA Media Tradizionali e Social Media
    trad_col = get_col_by_keyword(df_survey, "testate giornalistiche nazionali")
    df_survey[trad_col] = pd.to_numeric(df_survey[trad_col], errors='coerce').replace(99, np.nan)
    df_scored['trust_traditional'] = df_survey[trad_col]

    social_col = get_col_by_keyword(df_survey, "social media più popolari")
    df_survey[social_col] = pd.to_numeric(df_survey[social_col], errors='coerce').replace(99, np.nan)
    df_scored['trust_social'] = df_survey[social_col]
    
    # Fiducia Media Totale (Combinata)
    df_scored['media_trust'] = df_survey[[trad_col, social_col]].mean(axis=1, skipna=True)

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
# 4. MERGE, Z-SCORES E ANALISI STATISTICA GLM
# ==========================================================================

print("\n--- INIZIO PIPELINE DATI ---")
df_behavior = get_telemetry_data('db.sqlite3')
df_behavior['Participant ID'] = df_behavior['Participant ID'].astype(str).str.replace('-', '').str.strip().str.lower()
df_scores = calculate_survey_scores('Pre-Survey_iBEAREr.xlsx')

df = pd.merge(df_behavior, df_scores, on='Participant ID', how='inner')
print(f"🔗 Merge Definitivo Completato: {len(df)} osservazioni totali da elaborare.\n")

# STANDARDIZZAZIONE Z-SCORE (Media=0, DevStd=1)
continuous_vars = ['support', 'conspiracy_mindset', 'media_trust', 'trust_traditional', 'trust_social', 'aot_closed_mindset']
for var in continuous_vars:
    df[f"{var}_z"] = zscore(df[var], nan_policy='omit')

# --- HP1: CHI-QUADRATO SUL CTR ---
print("======================================================")
print("📌 HP1: Impatto del Sensazionalismo sul CTR")
print("======================================================")
contingency_table = pd.crosstab(df['content_sensationalism'], df['click'])
print(contingency_table)
chi2, p_val, dof, expected = stats.chi2_contingency(contingency_table)
print(f"p-value = {p_val:.4f} -> {'SIGNIFICATIVO (Confermata)' if p_val < 0.05 else 'NON Significativo (Rifiutata)'}")

# --- HP2-4: MODELLI GLM CON VARIABILI STANDARDIZZATE ---
print("\n======================================================")
print("📌 HP2-4: Modulazione Psicologica (Modelli GLM - Z-Scores)")
print("======================================================")

# LISTA COMPLETA DEI 6 MODELLI
models_to_run = [
    ('support_z', 'Supporto a Berlusconi'),
    ('conspiracy_mindset_z', 'Complottismo CTB'),
    ('aot_closed_mindset_z', 'Chiusura Mentale AOT-E'),
    ('media_trust_z', 'Fiducia nei Media (Totale)'),
    ('trust_traditional_z', 'Fiducia Media Tradizionali'),
    ('trust_social_z', 'Fiducia Social Media')
]

for var, name in models_to_run:
    df_clean = df.dropna(subset=[var])
    model = smf.glm(f"click ~ {var} * content_sensationalism", data=df_clean, family=sm.families.Binomial(link=sm.families.links.Logit())).fit()
    print(f"\n--- {name} (n={len(df_clean)}) ---")
    print(model.summary())


# ==========================================================================
# 5. POST-HOC TEST (T-Test su 1 riga per utente - Confronto tra Framing)
# ==========================================================================
print("\n======================================================")
print("📌 Confronto Sensazionalistico vs Giornalistico")
print("======================================================")

framing_types = [(1, 'Post SENSAZIONALISTICI'), (0, 'Post GIORNALISTICI')]
variables_to_test = [
    ('support', 'Supporto a Berlusconi'), 
    ('trust_traditional', 'Fiducia nei Media Tradizionali'),
    ('trust_social', 'Fiducia nei Social Media')
]

for var, var_name in variables_to_test:
    print(f"\n--- {var_name} ---")

    for f_val, f_name in framing_types:
        # 1. FILTRIAMO IL DATAFRAME: Prendiamo SOLO i post sensazionalistici o SOLO quelli giornalistici
        df_subset = df[df['content_sensationalism'] == f_val]

        # 2. Aggreghiamo i dati: 1 riga per utente (Calcoliamo il CTR medio di quell'utente)
        df_user = df_subset.groupby('Participant ID').agg({
            'click': 'mean',
            'support': 'first',
            'trust_traditional': 'first',
            'trust_social': 'first'
        }).reset_index()

        # 3. Eseguiamo il T-Test separando per la Mediana (Alto vs Basso)
        df_clean = df_user.dropna(subset=[var, 'click'])
        median_val = df_clean[var].median()

        group_high = df_clean[df_clean[var] > median_val]['click']
        group_low = df_clean[df_clean[var] <= median_val]['click']

        if len(group_high) < 2 or len(group_low) < 2:
            print(f"   Impossibile eseguire il test su {f_name} (gruppi troppo piccoli).")
            continue

        t_stat, p_val = stats.ttest_ind(group_high, group_low, equal_var=False)

        print(f"\n{f_name}:")
        print(f"   Media CTR Utenti 'Alto': {group_high.mean():.2f}")
        print(f"   Media CTR Utenti 'Basso': {group_low.mean():.2f}")
        print(f"   t-statistic: {t_stat:.4f} | p-value: {p_val:.4f}")

        if p_val < 0.05:
            print(f"      ✅ Differenza SIGNIFICATIVA!")
        else:
            print(f"      ❌ Differenza NON significativa.")

# ==========================================================================
# 6. VISUALIZZAZIONE GRAFICA 1: BAR CHART
# ==========================================================================
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
# 7. VISUALIZZAZIONE GRAFICA 2: EFFETTI DI MODERAZIONE (6 PLOTS)
# ==========================================================================
print("\nGenerazione dei grafici di interazione (Plot 2)...")

df_plot = df.copy()
df_plot['Framing'] = df_plot['content_sensationalism'].map({0: 'Giornalistico', 1: 'Sensazionalistico'})

# Median split manuale per tutti e 6 i tratti
df_plot['Supporto Berlusconi'] = np.where(df_plot['support'] > df_plot['support'].median(), 'Alto', 'Basso')
df_plot['Complottismo (CTB)'] = np.where(df_plot['conspiracy_mindset'] > df_plot['conspiracy_mindset'].median(), 'Alto', 'Basso')
df_plot['Chiusura Mentale (AOT)'] = np.where(df_plot['aot_closed_mindset'] > df_plot['aot_closed_mindset'].median(), 'Alto', 'Basso')
df_plot['Fiducia nei Media (Tot)'] = np.where(df_plot['media_trust'] > df_plot['media_trust'].median(), 'Alto', 'Basso')
df_plot['Fiducia Tradizionali'] = np.where(df_plot['trust_traditional'] > df_plot['trust_traditional'].median(), 'Alto', 'Basso')
df_plot['Fiducia Social'] = np.where(df_plot['trust_social'] > df_plot['trust_social'].median(), 'Alto', 'Basso')

# DIMENSIONI FOGLIO A4: 8.27 x 11.69 pollici (proporzioni perfette per la stampa o PDF)
fig, axes = plt.subplots(3, 2, figsize=(8.27, 11.69))

# Mappiamo i 6 moderatori ai 6 subplot della griglia (3 righe x 2 colonne)
moderators = [
    ('Supporto Berlusconi', axes[0, 0]),
    ('Complottismo (CTB)', axes[0, 1]),
    ('Chiusura Mentale (AOT)', axes[1, 0]),
    ('Fiducia nei Media (Tot)', axes[1, 1]),
    ('Fiducia Tradizionali', axes[2, 0]),
    ('Fiducia Social', axes[2, 1])
]

# Colori fissi assoluti
palette = {'Basso': '#1f77b4', 'Alto': '#d62728'}

for mod_name, ax in moderators:
    sns.pointplot(
        data=df_plot, 
        x='Framing', 
        y='click', 
        hue=mod_name, 
        hue_order=['Basso', 'Alto'],
        dodge=True,
        markers=['o', 's'],
        capsize=.1,
        err_kws={'linewidth': 1.5},
        ax=ax,
        palette=palette
    )
    # Riduciamo leggermente i font per farli stare comodamente nel layout A4
    ax.set_title(f'{mod_name}', fontsize=11)
    ax.set_ylabel('Probabilità Media di Click (CTR)', fontsize=9)
    ax.set_xlabel('')
    ax.tick_params(axis='both', labelsize=9)
    ax.set_ylim(0, 1)
    ax.grid(True, axis='y', linestyle='--', alpha=0.7)

# Ottimizza gli spazi per evitare sovrapposizioni nei margini del foglio
plt.tight_layout()
plt.savefig('modulazione_psicologica_A4.pdf', dpi=300, bbox_inches='tight')
plt.show()