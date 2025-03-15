import boto3
import os
import base64
import json
from io import BytesIO
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from botocore.exceptions import ClientError

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure s3 client
S3_CLIENT = boto3.client(
    'S3_CLIENT',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION')
)

BUCKET_NAME = os.getenv('AWS_BUCKET_NAME')

def upload_to_s3(file_name, file_data):
    try:
        S3_CLIENT.put_object(Bucket=BUCKET_NAME, Key=file_name, Body=file_data)

        return S3_CLIENT.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET_NAME, 'Key': file_name},
            ExpiresIn=3600
        )
    except ClientError as e:
        print(e)
        return None

@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    try:

        data = request.get_json()
    
        base64_image = data.get('image')
        filename = data.get('filename')

        original_filename = f"original_{filename}"
        
        original_url = upload_to_s3(original_filename, base64_image)

        if not original_url:
            return jsonify({'error': 'Failed to upload images to S3_CLIENT'}), 500

        return jsonify({
            'original': original_url,
        })

    except Exception as e:
        print(e)
        return jsonify({'error': 'Server error'}), 500

def retrieve_manipulated_images_from_S3(filename):
    try:
        red_img_name = filename + "red"
        green_img_name = filename + "green"
        blue_img_name = filename + "blue"
        
        red_img = S3_CLIENT.get_object(Bucket=BUCKET_NAME, Key=red_img_name)
        red_img_responce = json.loads(red_img['Body'].read().decode('utf-8'))

        green_img = S3_CLIENT.get_object(Bucket=BUCKET_NAME, Key=green_img_name)
        green_img_responce = json.loads(green_img['Body'].read().decode('utf-8'))

        blue_img = S3_CLIENT.get_object(Bucket=BUCKET_NAME, Key=blue_img_name)
        blue_img_responce = json.load(green_img['Body'].read().decode('utf-8'))

        return red_img_responce, green_img_responce, blue_img_responce

    except Exception as e:
        print(e)
        return None

@app.route('/api/retrieve-manipulated-images', methods=['POST'])
def retrieve_manipulated_images():
    try:

        data = request.get_json()

        filename = data.get('filename')

        red_url, green_url, blue_url = retrieve_manipulated_images_from_S3(filename)

        return jsonify({
            'red': red_url,
            'green': green_url,
            'blue_url': blue_url,
        })
        
    except Exception as e:
        print(e)
        return jsonify({'error': 'Server error'}), 500
        
if __name__ == '__main__':
    app.run(debug=True)