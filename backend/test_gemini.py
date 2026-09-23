import os
from google import genai

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def test_model():
    try:
        response = client.models.generate_content(
            model="models/gemini-1.5-pro",   # ✅ updated model name
            contents=[
                genai.types.Content(
                    role="user",
                    parts=[
                        genai.types.Part(text="Hello Gemini! Can you confirm you are working?")
                    ]
                )
            ]
        )
        print("✅ Gemini responded:", response.text)
    except Exception as e:
        print("❌ Error:", str(e))

if __name__ == "__main__":
    test_model()
