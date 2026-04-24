# Usa un'immagine Python ufficiale e leggera
FROM python:3.10-slim

# Imposta variabili d'ambiente per Python (niente file .pyc e output diretto su console)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Imposta la cartella di lavoro dentro il container
WORKDIR /app

# Copia il file dei requisiti e installa le dipendenze
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copia tutto il resto del codice del progetto
COPY . /app/

# Esponi la porta 8000
EXPOSE 8000

# Comando di default per avviare il server
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]