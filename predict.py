import sys
from ultralytics import YOLO
import cv2

def main():
    if len(sys.argv) < 2:
        print("Usage: python predict.py <image_path>")
        sys.exit(1)

    image_path = sys.argv[1]

    # Load the default YOLO object detection model (we can change this to your custom one later!)
    model = YOLO("yolov8x.pt")
    
    print(f"\nAnalyzing '{image_path}' with YOLOv8...\n")
    
    # Run prediction
    results = model.predict(image_path)
    
    # Print the results
    result = results[0]
    
    if len(result.boxes) == 0:
        print("No bounding boxes detected by YOLO.")
    else:
        print("Detected objects:")
        for box in result.boxes:
            class_id = int(box.cls[0].item())
            class_name = model.names[class_id]
            confidence = float(box.conf[0].item())
            print(f" - {class_name} ({confidence*100:.1f}% confidence)")
            
    # Optional: save the image with boxes drawn on it
    annotated_img = result.plot()
    output_path = "output_prediction.jpg"
    cv2.imwrite(output_path, annotated_img)
    print(f"\nSaved an image with the bounding boxes drawn to: {output_path}")

if __name__ == "__main__":
    main()
