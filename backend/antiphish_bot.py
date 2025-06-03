import os
import base64
import requests
import time
from flask import Flask, request, jsonify

app = Flask(__name__)

VT_API_KEY = os.getenv("VT_API_KEY")

def check_url_with_virustotal(url):
    headers = {
        "x-apikey": VT_API_KEY
    }

    # Step 1: Check if already analyzed
    url_id = base64.urlsafe_b64encode(url.encode()).decode().strip("=")
    api_url = f"https://www.virustotal.com/api/v3/urls/{url_id}"

    response = requests.get(api_url, headers=headers)

    if response.status_code == 200:
        data = response.json()
        stats = data.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
        return {"status": "found", "stats": stats}

    elif response.status_code == 404:
        # Step 2: Submit URL for analysis
        submit_url = "https://www.virustotal.com/api/v3/urls"
        submit_response = requests.post(submit_url, headers=headers, data={"url": url})
        
        if submit_response.status_code == 200:
            analysis_id = submit_response.json().get("data", {}).get("id")
            
            # Step 3: Wait for the analysis to complete
            time.sleep(15)  # optional: increase if it's still not ready

            # Step 4: Poll the analysis result
            analysis_url = f"https://www.virustotal.com/api/v3/analyses/{analysis_id}"
            analysis_response = requests.get(analysis_url, headers=headers)

            if analysis_response.status_code == 200:
                analysis_data = analysis_response.json()
                status = analysis_data.get("data", {}).get("attributes", {}).get("status")

                if status == "completed":
                    stats = analysis_data.get("data", {}).get("attributes", {}).get("stats", {})
                    return {"status": "found", "stats": stats}
                else:
                    return {"status": "pending", "message": "Scan still processing. Try again later."}
            else:
                return {"status": "error", "message": "Failed to retrieve scan results."}
        else:
            return {"status": "error", "message": "Failed to submit URL for scanning."}
    else:
        return {"status": "error", "message": f"API error: {response.status_code}"}


@app.route('/api/check_url', methods=['POST'])
def api_check_url():
    data = request.json
    if not data or "url" not in data:
        return jsonify({"error": "Missing 'url' parameter"}), 400

    url = data["url"]
    result = check_url_with_virustotal(url)
    return jsonify(result)

@app.route('/api/command', methods=['POST'])
def handle_command():
    data = request.json
    if not data or "command" not in data:
        return jsonify({"error": "Missing 'command' parameter"}), 400
    
    command = data["command"].strip().lower()

    # Example command: "@antiphish run check http://someurl.com"
    if command.startswith("@antiphish run check"):
        parts = command.split()
        if len(parts) < 4:
            return jsonify({"error": "URL not provided in command."}), 400
        url = parts[3]
        result = check_url_with_virustotal(url)
        if result.get("status") == "found":
            stats = result["stats"]
            message = (
                f"VirusTotal scan results for {url}:\n"
                f"Harmless: {stats.get('harmless', 0)}\n"
                f"Malicious: {stats.get('malicious', 0)}\n"
                f"Suspicious: {stats.get('suspicious', 0)}\n"
                f"Undetected: {stats.get('undetected', 0)}"
            )
        else:
            message = result.get("message", "An error occurred.")
        return jsonify({"reply": message})

    return jsonify({"reply": "Unknown command."})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
