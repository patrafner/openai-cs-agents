# Security Setup Guide: Environment Variables & API Keys

## ⚠️ Important: Rotate Your API Key

Your API key has been exposed in the conversation history and must be rotated immediately:

1. **Go to OpenAI API Keys page**: https://platform.openai.com/api-keys
2. **Delete the old key** (the one starting with `sk-proj-YWJOgRhveFP8QuvoPXwbtJY...`)
3. **Generate a new API key**
4. **Copy the new key** (you won't see it again!)

## Setup Instructions

### Backend (Python - FastAPI)

#### Option 1: Using Load Env File (Recommended)

1. **Edit `.env.local`** in `/python-backend/`:
   ```bash
   OPENAI_API_KEY=sk-your-new-api-key-here
   ```

2. **Install python-dotenv** (if not already installed):
   ```bash
   cd python-backend
   pip install python-dotenv
   ```

3. **Run with automatic .env loading**:
   ```bash
   cd python-backend
   python3 -m dotenv run uvicorn main:app --reload --port 8000
   ```

#### Option 2: Load Env File Manually in Code

Add this to the top of `main.py` after imports:
```python
from dotenv import load_dotenv
load_dotenv()  # This loads .env.local automatically
```

Then run normally:
```bash
cd python-backend
uvicorn main:app --reload --port 8000
```

#### Option 3: Load Env Before Running (Shell Script)

```bash
cd python-backend
source .env.local
python3 -m uvicorn main:app --reload --port 8000
```

### Frontend (Next.js)

1. **Edit `.env.local`** in `/ui/`:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

2. **Run the dev server** (Next.js automatically loads .env.local):
   ```bash
   cd ui
   npm run dev
   ```

## File Structure

```
openai-cs-agents-demo-v1/
├── .env.local              ← DO NOT COMMIT (contains secrets)
├── .gitignore              ← Updated to exclude .env files
├── python-backend/
│   ├── .env.local          ← DO NOT COMMIT (your API key goes here)
│   └── main.py
└── ui/
    ├── .env.local          ← DO NOT COMMIT
    └── app/
```

## ✅ Verified Security Practices

Your code is already following best practices:
- ✅ API key is NOT hardcoded in any files
- ✅ API key is read from environment variables
- ✅ `.env.local` files are now in `.gitignore`
- ✅ No secrets will be committed to git

## 🔒 Best Practices Moving Forward

1. **Never commit `.env.local`** to git (it's in .gitignore now)
2. **Never paste API keys** in chat, docs, or code
3. **Rotate keys** if they're ever exposed
4. **Use different keys** for development vs. production
5. **Set expiration dates** on API keys (if your provider supports it)

## Testing Your Setup

Once configured, test that everything works:

```bash
# Terminal 1: Run backend
cd python-backend
python3 -m dotenv run uvicorn main:app --reload --port 8000

# Terminal 2: Run frontend  
cd ui
npm run dev
```

Then visit `http://localhost:3000` and send a message to verify the connection works.
