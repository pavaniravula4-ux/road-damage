import os
from google import genai
from dotenv import load_dotenv
load_dotenv()

# Initialize Gemini client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def analyze_image(filepath: str) -> str:
    """
    Analyze a road damage image using Gemini Vision API.
    Returns severity classification (minor, moderate, severe).
    """
    try:
        chat = client.chats.create(model="gemini-1.0-pro-vision")
        response = chat.send_message([
            genai.types.Part(
                file_data=genai.types.FileData(
                    mime_type="image/jpeg",
                    file_uri=filepath
                )
            ),
            genai.types.Part(
                text="Analyze this road image and classify damage severity (minor, moderate, severe)."
            )
        ])
        return response.text.strip() if response.text else "No analysis returned"
    except Exception as e:
        return f"AI analysis failed: {str(e)}"

# Example usage (for testing only):
if __name__ == "__main__":
    test_path = "uploads/test.jpg"
    print(analyze_image(test_path))
