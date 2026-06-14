FROM python:3.9-slim

WORKDIR /app

# Install system dependencies if any are needed for SQLite, Pillow, or other libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Hugging Face Spaces requires running as a non-root user
RUN useradd -m -u 1000 user

# Copy the rest of the application files
COPY --chown=user:user . /app

# Set permissions so the app can create and write to the SQLite database
# We change permissions of the app directory because SQLite needs to create journal files alongside the .db file
RUN chmod 777 /app
RUN touch /app/users.db && chmod 666 /app/users.db

# Switch to the non-root user
USER user

# Expose port 7860 as required by Hugging Face Spaces
EXPOSE 7860

# Run the app
CMD ["python", "app.py"]
