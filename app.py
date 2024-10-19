from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import random
import requests
import numpy as np
import pickle
import os
from data import data_practice, tag_descriptions, news
from pyecharts.charts import Scatter
from pyecharts import options as opts
from sklearn.manifold import TSNE

app = Flask(__name__)

# 示例数据



CORS(app, resources={r"/*": {"origins": "http://127.0.0.1:8080", "supports_credentials": True}})

# Hugging Face API 配置
API_URL = "https://gefut9s505kg2n0v.us-east-1.aws.endpoints.huggingface.cloud"
headers = {
	"Accept" : "application/json",
	"Content-Type": "application/json" 
}

# 缓存嵌入和相似度
embedding_cache = {}


# 缓存文件路径
CACHE_FILE = 'embedding_cache.pkl'

def load_cache():
    global embedding_cache
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'rb') as f:
            embedding_cache = pickle.load(f)

def save_cache():
    with open(CACHE_FILE, 'wb') as f:
        pickle.dump(embedding_cache, f)

def get_embedding(text):
    if text in embedding_cache:
        if type(embedding_cache[text]) != dict:
            return embedding_cache[text]
    response = requests.post(API_URL, headers=headers, json={"inputs": text, "parameters": {}})
    embedding =  response.json()
    embedding_cache[text] = embedding

    save_cache()  # 保存缓存
    return embedding

def cosine_similarity(vec1, vec2):
    vec1 = np.array(vec1)
    vec2 = np.array(vec2).T
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

def calculate_similarity(text):
    text_embedding = get_embedding(text)
    tag_embeddings = {tag: get_embedding(tag + " " + description) for tag, description in tag_descriptions.items()}
    similarities = {tag: cosine_similarity(text_embedding, embedding) for tag, embedding in tag_embeddings.items()}
    #transfomr similarities to float
    similarities = {tag: float(similarity) for tag, similarity in similarities.items()}
    sorted_tags = sorted(similarities.items(), key=lambda item: item[1], reverse=True)
    print(sorted_tags) 
    return sorted_tags

def calculate_similarity_with_data_practice(text):
    text_embedding = get_embedding(text)
    data_practice_embeddings = {description: get_embedding(description) for description in data_practice}
    similarities = {tag: float(cosine_similarity(text_embedding, embedding)) for tag, embedding in data_practice_embeddings.items()}
    sorted_tags = sorted(similarities.items(), key=lambda item: item[1], reverse=True)

    return sorted_tags

@app.route('/calculate', methods=['POST'])
@cross_origin(origin='http://127.0.0.1:8080', headers=['Content-Type', 'Authorization'], methods=['POST'], supports_credentials=True)
def calculate():
    data = request.json
    text = data.get('text', '')
    tags = calculate_similarity(text)
    tags_with_descriptions = [{'tag': tag, 'description': tag_descriptions.get(tag, 'No description available'), 'similarity': similarity} for tag, similarity in tags]
    print(tags_with_descriptions)
    return jsonify(tags_with_descriptions)

@app.route('/calculate_with_data_practice', methods=['POST'])
@cross_origin(origin='http://127.0.0.1:8080', headers=['Content-Type', 'Authorization'], methods=['POST'], supports_credentials=True)
def calculate_with_data_practice():
    data = request.json
    text = data.get('text', '')
    tags = calculate_similarity_with_data_practice(text)
    tags_with_descriptions = [{'tag': tag[:80], 'description': tag, 'similarity': similarity} for tag, similarity in tags]
    return jsonify(tags_with_descriptions)

#get news
@app.route('/get_news', methods=['GET'])
@cross_origin(origin='http://127.0.0.1:8080', headers=['Content-Type', 'Authorization'], methods=['GET'], supports_credentials=True)
def get_news():
    new = random.choice(news)
    return jsonify(new)

@app.route('/get_data_practice', methods=['GET'])
@cross_origin(origin='http://127.0.0.1:8080', headers=['Content-Type', 'Authorization'], methods=['GET'], supports_credentials=True)
def get_data_practice():
    practice = random.choice(data_practice)
    return jsonify(practice)

@app.route('/get_label', methods=['GET'])
@cross_origin(origin='http://127.0.0.1:8080', headers=['Content-Type', 'Authorization'], methods=['GET'], supports_credentials=True)
def get_label():
    #random select a tag
    tag = random.choice(list(tag_descriptions.keys()))
    return jsonify({
        "tag": tag,
        "description": tag_descriptions[tag]
    })

@app.route('/generate_chart', methods=['POST'])
@cross_origin(origin='http://127.0.0.1:8080', headers=['Content-Type', 'Authorization'], methods=['POST'], supports_credentials=True)
def generate_chart():
    data = request.json
    text = data.get('text', '')
    tags = calculate_similarity(text)
    tags_with_descriptions = [{'tag': tag, 'description': tag_descriptions.get(tag, 'No description available'), 'similarity': float(similarity)} for tag, similarity in tags]
    
    # Get embeddings for query and tags
    query_embedding = get_embedding(text)
    tag_embeddings = [get_embedding(tag + " " + description) for tag, description in tag_descriptions.items()]
    
    # Combine query embedding with tag embeddings
    all_embeddings = [query_embedding] + tag_embeddings
    
    # Convert embeddings to numpy array
    all_embeddings_np = np.array(all_embeddings)
    
    # Apply T-SNE for dimensionality reduction
    tsne = TSNE(n_components=2, random_state=42)
    all_embeddings_np = np.array(all_embeddings).squeeze(axis=1)    
    reduced_embeddings = tsne.fit_transform(all_embeddings_np)
    
    # Prepare chart data
    chart_data = [{'x': float(reduced_embeddings[0][0]), 'y': float(reduced_embeddings[0][1]), 'tag': 'Query', 'similarity': float(1.00), 'description': text}]
    for i, (tag, similarity) in enumerate(tags):
        chart_data.append({'x': float(reduced_embeddings[i+1][0]), 'y': float(reduced_embeddings[i+1][1]), 'tag': tag, 'similarity': float(similarity)})
    
    return jsonify(chart_data)

if __name__ == "__main__":
    load_cache()  # 加载缓存
    app.run(debug=True)
