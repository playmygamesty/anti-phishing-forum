import requests
import os

API_KEY = os.getenv("ZYLA_API_KEY")  # Store your API key safely in environment variables
API_URL = "https://api.zylalabs.com/v1/url/check"

def check_url(url):
    headers = {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    data = {"url": url}
    try:
        response = requests.post(API_URL, json=data, headers=headers)
        response.raise_for_status()
        result = response.json()

        # Parse the result, example keys based on typical response
        status = result.get("status")
        score = result.get("risk_score", 0)  # hypothetical risk score 0-100

        if status == "safe":
            return "✅ URL looks safe."
        elif status == "malicious" or score > 70:
            return "⚠️ Warning: URL looks suspicious or malicious!"
        else:
            return "⚠️ Caution: URL might be risky."

    except Exception as e:
        return f"❌ Could not check URL due to error: {str(e)}"
