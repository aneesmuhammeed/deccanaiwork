import os
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

# Allow requests from Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("Warning: Supabase credentials missing. Check your .env.local file.")
    supabase_client = None
else:
    # Use postgrest client directly to bypass JWT validation on local/mock keys
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

class AddRequest(BaseModel):
    content: str

class SearchRequest(BaseModel):
    query: str

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

@app.post("/api/add")
async def add_study_item(request: AddRequest):
    if not request.content:
        raise HTTPException(status_code=400, detail="Content is required")
        
    try:
        # 1. Generate the embedding vector from Gemini
        embedding = generate_embedding(request.content)
        
        # 2. Insert into Supabase
        # Format the array as a Postgres vector string: "[1.0, 2.0, ...]"
        vector_string = "[" + ",".join(map(str, embedding)) + "]"
        
        if not supabase_client:
            raise HTTPException(status_code=500, detail="Supabase client not initialized")
            
        response = supabase_client.from_("study_items").insert({
            "content": request.content,
            "embedding": vector_string
        }).execute()
        
        return {"success": True, "data": response.data if hasattr(response, 'data') else response[1] if isinstance(response, tuple) else response}
    except Exception as e:
        print(f"API Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.post("/api/search")
async def search_study_items(request: SearchRequest):
    if not request.query:
        raise HTTPException(status_code=400, detail="Query is required")
        
    try:
        # 1. Generate the embedding for the search query using Gemini
        embedding = generate_embedding(request.query)
        vector_string = "[" + ",".join(map(str, embedding)) + "]"
        
        if not supabase_client:
            raise HTTPException(status_code=500, detail="Supabase client not initialized")
            
        # 2. Call the Supabase function to find similar items
        response = supabase_client.rpc(
            "match_study_items",
            {
                "query_embedding": vector_string,
                "match_threshold": 0.5,
                "match_count": 5
            }
        ).execute()
        
        return {"success": True, "data": response.data if hasattr(response, 'data') else response[1] if isinstance(response, tuple) else response}
    except Exception as e:
        print(f"API Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
