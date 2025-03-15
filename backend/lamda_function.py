import boto3
import io
import os
import numpy as np
from PIL import Image, ImageOps
from io import BytesIO
import os
from urllib.parse import unquote_plus

DESTINATION_BUCKET = os.environ["DESTINATION_BUCKET"]
S3_CLIENT = boto3.client("s3")

def create_channel_images(original_image):
    
    red_img_arr = np.array(original_image)
    red_img_arr[:, :, 1] = 0
    red_img_arr[:, :, 2] = 0

    green_img_arr = np.array(original_image)
    green_img_arr[:, :, 0] = 0
    green_img_arr[:, :, 2] = 0

    blue_img_arr = np.array(original_image)
    blue_img_arr[:, :, 0] = 0
    blue_img_arr[:, :, 1] = 0

    return Image.fromarray(red_img_arr), Image.fromarray(green_img_arr), Image.fromarray(blue_img_arr)

def create_bw_image(original_image):
    return original_image.convert("L")

def create_inverted_image(original_image):
    return ImageOps.invert(original_image)

# Not utilized
def create_sorted_hsv_images(original_image):
    
    hue_img_arr = np.array(original_image.convert("HSV"))
    sorted_hue = np.sort(hue_img_arr[:, :, 0].flatten())[::-1]

    saturation_img_arr = np.array(original_image.convert("HSV"))
    sorted_saturation = np.sort(saturation_img_arr[:, :, 1].flatten())[::-1]

    brightness_img_arr = np.array(original_image.convert("HSV"))
    sorted_brightness = np.sort(brightness_img_arr[:, :, 2].flatten())[::-1]

    return Image.fromarray(sorted_hue), Image.fromarray(sorted_saturation), Image.fromarray(sorted_brightness)

def upload_processed_image_to_S3(object_key, tag, image):

    try:
        buffer = io.BytesIO()
        image.save(buffer, "JPEG")
        buffer.seek(0)

        img_key = f"{tag}/{object_key}"

        S3_CLIENT.put_object(
            Bucket="photo-splitter", 
            Key=img_key, 
            Body=buffer.getvalue()
        )
    
    except Exception as e:
        raise

def process_record(record):

    s3_object = record["s3"]
    source_bucket = s3_object["bucket"]["name"]
    object_key = unquote_plus(s3_object["object"]["key"])

    try: 
        s3_responce = S3_CLIENT.get_object(Bucket=source_bucket, Key=object_key)
        original_image = Image.open(BytesIO(s3_responce["Body"].read())).convert(dither="RGB")

        red_img, green_img, blue_img = create_channel_images(original_image)
        #hue_img, saturation_img, brightness_img = create_sorted_hsv_images(original_image)
        bw_img = create_bw_image(original_image)
        inverted_img = create_inverted_image(original_image)

        #[("red", red_img), ("green", green_img), ("blue", blue_img), ("sortedHue", hue_img), ("sortedBrightness", brightness_img), ("sortedSaturation", saturation_img), ("bw", bw_img), ("inverted", inverted_img)]:
        for tag, img in [("red", red_img), ("green", green_img), ("blue", blue_img), ("bw", bw_img), ("inverted", inverted_img)]:
            upload_processed_image_to_S3(object_key, tag, img)
    
    except Exception as e:
        raise

def lambda_handler(event, context):

    record = event["Records"]

    try:

        process_record(record)

        return {
            "statusCode": 200,
            "body": "Processed request successfully",
        }
    except Exception as e:

        error_msg = f"Error processing request: {str(e)}"

        return {
            "statusCode": 500,
            "body": error_msg,
        }