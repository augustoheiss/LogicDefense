import random
from datetime import date
import calendar

filename = "simulacao_assistente_moeda_5anos.csv"

# 1. Cabeçalho com as metas dinâmicas de 2021 a 2025
header_lines = [
    "## COIN ASSISTANT BACKUP v2 ##\n",
    "name,Simulação 5 Anos (Teste de Estresse)\n",
    "description,Dados Históricos de 2021 a 2025\n",
    "goal_daily_2021,70\n",
    "goal_weekly_2021,490\n",
    "goal_annual_2021,25000\n",
    "goal_daily_2022,75\n",
    "goal_weekly_2022,525\n",
    "goal_annual_2022,28000\n",
    "goal_daily_2023,80\n",
    "goal_weekly_2023,560\n",
    "goal_annual_2023,31000\n",
    "goal_daily_2024,85\n",
    "goal_weekly_2024,595\n",
    "goal_annual_2024,34000\n",
    "goal_daily_2025,90\n",
    "goal_weekly_2025,630\n",
    "goal_annual_2025,37000\n",
    "## ROWS ##\n",
    "date,value,description,entryType,monthlyValue,monthCount,period_start,period_end\n"
]

rows = []

def add_row(d, val, desc, etype, m_val="", m_cnt="", p_start="", p_end=""):
    rows.append(f"{d},{val},{desc},{etype},{m_val},{m_cnt},{p_start},{p_end}\n")

# 2. Despesa Gigante: Financiamento de longo prazo (5 anos = 60 meses)
add_row("2021-01-01", 85000, "Financiamento Veículo (5 Anos)", "expense", 1416.66, 60, "2021-01-01", "2025-12-31")

for year in range(2021, 2026):
    # Despesas Anuais Fixas
    ipva_val = random.randint(4000, 6000)
    seguro_val = random.randint(8000, 11000)
    
    add_row(f"{year}-01-01", ipva_val, f"IPVA {year}", "expense", round(ipva_val/12, 2), 12, f"{year}-01-01", f"{year}-12-31")
    add_row(f"{year}-01-01", seguro_val, f"Seguro {year}", "expense", round(seguro_val/12, 2), 12, f"{year}-01-01", f"{year}-12-31")

    # 1 Dispensa/Férias por ano
    waiver_month = random.randint(1, 12)
    waiver_start = date(year, waiver_month, random.randint(1, 20))
    waiver_days = random.randint(7, 15)
    add_row(waiver_start.strftime("%Y-%m-%d"), waiver_days, f"Férias/Descanso {year}", "waiver")

    for month in range(1, 13):
        num_days = calendar.monthrange(year, month)[1]
        
        # Simula dias trabalhados no mês (entre 18 e 25 dias)
        revenue_days = random.sample(range(1, num_days+1), k=random.randint(18, 25))
        revenue_days.sort()

        monthly_revenue = 0
        for day in revenue_days:
            # Receita diária variando
            val = round(random.uniform(150, 480), 2)
            monthly_revenue += val
            d_str = date(year, month, day).strftime("%Y-%m-%d")
            add_row(d_str, val, "PIX/Cartão Receita Diária", "revenue")

        # Investimento mensal (Aporte de 10% a 25% da receita do mês)
        deposit_val = round(monthly_revenue * random.uniform(0.10, 0.25), 2)
        dep_day = random.randint(25, min(28, num_days))
        dep_d_str = date(year, month, dep_day).strftime("%Y-%m-%d")
        add_row(dep_d_str, deposit_val, f"Aporte Investimento {month}/{year}", "deposit")

        # Manutenção surpresa (a cada 3 ou 4 meses)
        if month % random.randint(3, 4) == 0:
            maint_val = round(random.uniform(400, 2000), 2)
            maint_day = random.randint(1, 20)
            maint_d_str = date(year, month, maint_day).strftime("%Y-%m-%d")
            add_row(maint_d_str, maint_val, f"Manutenção Extra", "expense", maint_val, 1, "", "")

# 3. Geração do Arquivo
with open(filename, 'w', encoding='utf-8') as f:
    f.writelines(header_lines)
    f.writelines(rows)

print("Arquivo gerado com sucesso!")