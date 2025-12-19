# Use an official lightweight Python image
FROM python:3.9-slim

# Set the working directory inside the container
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies (ensure requirements.txt is clean!)
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Railway sets a $PORT variable. We must listen on it.
# We launch 'index:app' because your file is named index.py
CMD uvicorn index:app --host 0.0.0.0 --port $PORT
