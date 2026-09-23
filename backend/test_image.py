import os
from google import genai

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def test_image(filepath: str):
    try:
        response = client.models.generate_content(
            model="models/gemini-1.0-pro-vision",   # ✅ stable image+text model
            contents=[
                genai.types.Content(
                    role="user",
                    parts=[
                        genai.types.Part(
                            file_data=genai.types.FileData(
                                mime_type="image/jpeg",
                                file_uri=filepath
                            )
                        ),
                        genai.types.Part(
                            text="Describe this image and classify road damage severity (minor, moderate, severe)."
                        )
                    ]
                )
            ]
        )
        print("✅ Gemini responded:", response.text)
    except Exception as e:
        print("❌ Error:", str(e))

if __name__ == "__main__":
    # Replace with a real image path in your uploads folder
    test_path = "uploads/test.jpg"
    test_image(test_path)
