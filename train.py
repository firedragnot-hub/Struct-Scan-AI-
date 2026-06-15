from ultralytics import YOLO

def main():
    # Load a CLASSIFICATION model (notice the '-cls.pt' suffix)
    model = YOLO("yolov8n-cls.pt")  

    # Train the classification model
    # For classification, we just provide the root directory containing 'train' and 'val' folders
    results = model.train(
        data="dataset",     
        epochs=50,          
        imgsz=224,          # 224 is the standard size for YOLO classification 
        batch=16,           
        name="custom_yolo_classifier", 
        device="cpu"        # Change to "0" if you have a compatible NVIDIA GPU
    )

    print("Training completed. Results saved to runs/classify/custom_yolo_classifier")

if __name__ == '__main__':
    # Required for Windows multiprocessing during training
    import multiprocessing
    multiprocessing.freeze_support()
    main()
