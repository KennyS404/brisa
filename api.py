from flask import Flask, request, jsonify
import requests
import json

app = Flask(__name__)

@app.route('/generate', methods=['POST'])
def generate():

    data = request.get_json()
    prompt = data.get("prompt", "")

    if not prompt:
        return jsonify({"error": "No prompt provided"}), 400


    url = 'http://localhost:11434/api/generate'
    api_data = {
        "model": "llama3",
        "prompt": prompt,
        "stream": False
    }
    print('TETSE')

    api_response = requests.post(url, json=api_data)
    print('TETSE', api_response)
    if api_response.status_code == 200:

        response_json = json.loads(api_response.text)
        

        message = response_json.get("response", "No response found")
        

        return jsonify({"message": message}), 200
    else:
        return jsonify({"error": f"Failed to retrieve response. Status code: {api_response.status_code}"}), api_response.status_code

if __name__ == '__main__':
    app.run(port=5000)
