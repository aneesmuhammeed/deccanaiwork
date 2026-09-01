import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from postgrest import SyncPostgrestClient
from google import genai
from google.genai import types

# Load environment variables from the root .env.local file
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

app = FastAPI()

# Allow requests from Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client via postgrest to bypass strict JWT check on mock keys
supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("Warning: Supabase credentials missing. Check your .env.local file.")
    supabase_client = None
else:
    supabase_client = SyncPostgrestClient(
        f"{supabase_url}/rest/v1", 
        headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"}
    )

# Initialize Gemini client
gemini_api_key = os.environ.get("GEMINI_API_KEY")
if not gemini_api_key:
    print("Warning: Gemini API Key is missing. Check your .env.local file.")
    ai = None
else:
    ai = genai.Client(api_key=gemini_api_key)

def generate_embedding(text: str):
    if not ai:
        raise HTTPException(status_code=500, detail="Gemini client not initialized")
    
    response = ai.models.embed_content(
        model='gemini-embedding-001',
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=768)
    )
    
    if not response.embeddings or len(response.embeddings) == 0:
        raise HTTPException(status_code=500, detail="Failed to generate embedding")
        
    return response.embeddings[0].values

class TriageRequest(BaseModel):
    ticket: str
    tier: str

@app.post("/api/seed")
async def seed_routine_tickets():
    """Seeds the vector database with a few known 'routine' tickets and their standard resolutions."""
    if not supabase_client:
        raise HTTPException(status_code=500, detail="Supabase client not initialized")
        
    routine_tickets = [
        {
            "issue": "I can't log in, password not working.",
            "resolution": "Please use the 'Forgot Password' link on the login page to reset your credentials."
        },
        {
            "issue": "The dashboard is loading slowly today.",
            "resolution": "We are experiencing slight delays during peak hours. Please refresh your page in 5 minutes."
        },
        {
            "issue": "How do I add a new user to my team?",
            "resolution": "Navigate to Settings -> Team Management -> click 'Add User' in the top right corner."
        }
    ]
    
    inserted = 0
    try:
        for t in routine_tickets:
            # We store JSON stringified content in the DB to hold both issue and resolution
            content_json = json.dumps(t)
            
            # Embed just the issue text so semantic search matches on the incoming problem
            embedding = generate_embedding(t["issue"])
            vector_string = "[" + ",".join(map(str, embedding)) + "]"
            
            supabase_client.from_("study_items").insert({
                "content": content_json,
                "embedding": vector_string
            }).execute()
            inserted += 1
            
        return {"success": True, "message": f"Successfully seeded {inserted} routine tickets."}
    except Exception as e:
        print(f"API Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during seeding")

@app.post("/api/triage")
async def triage_ticket(request: TriageRequest):
    if not request.ticket or not request.tier:
        raise HTTPException(status_code=400, detail="Ticket and tier are required")
        
    try:
        embedding = generate_embedding(request.ticket)
        vector_string = "[" + ",".join(map(str, embedding)) + "]"
        
        if not supabase_client:
            raise HTTPException(status_code=500, detail="Supabase client not initialized")
            
        # Call the existing RPC function that performs cosine distance search
        # We set a threshold of 0.72 (cosine distance < 0.28). Higher means stricter matching.
        response = supabase_client.rpc(
            "match_study_items",
            {
                "query_embedding": vector_string,
                "match_threshold": 0.72,
                "match_count": 1
            }
        ).execute()
        
        data = response.data if hasattr(response, 'data') else response[1] if isinstance(response, tuple) else response
        
        # Check if we got a match
        if data and len(data) > 0:
            matched_item = data[0]
            try:
                past_ticket = json.loads(matched_item["content"])
                
                # Check for our explicit risk demonstration:
                # If the tier is Enterprise, and the incoming ticket mentions "outage" or "timing out" or "blocked",
                # BUT the vector matched our routine "slow dashboard" ticket, flag it as a risk demonstration!
                is_risk_demo = False
                if request.tier == "Enterprise" and ("timing out" in request.ticket.lower() or "blocked" in request.ticket.lower() or "outage" in request.ticket.lower()):
                    is_risk_demo = True
                    
                return {
                    "action": "Auto-Resolved",
                    "resolution": past_ticket["resolution"],
                    "matched_issue": past_ticket["issue"],
                    "similarity": round(matched_item["similarity"], 2),
                    "is_risk_demo": is_risk_demo
                }
            except json.JSONDecodeError:
                # Fallback if old data is in DB
                pass

        # If no similar past ticket is found
        return {
            "action": "Escalated",
            "resolution": "This issue is unique or high-impact. Routing to a human support agent immediately based on SLA.",
            "is_risk_demo": False
        }
        
    except Exception as e:
        print(f"API Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
