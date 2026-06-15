import os
import shutil
import random

def split_dataset():
    # Your source directory with the raw images
    source_dir = r"C:\Users\Lenovo\Downloads\New folder (4)"
    
    # Where we will save the structured dataset for YOLO
    target_dir = r"C:\Users\Lenovo\Desktop\New folder (4)\dataset"
    
    # The folders representing your classes
    classes = ["CRACK BRICK", "CRACK COB", "CRACK STONE", "CRACK TILE"]
    
    train_ratio = 0.8 # 80% for training, 20% for validation
    
    for cls in classes:
        src_class_dir = os.path.join(source_dir, cls)
        if not os.path.exists(src_class_dir):
            print(f"Skipping {cls} (folder not found)")
            continue
            
        images = [f for f in os.listdir(src_class_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        random.shuffle(images)
        
        split_idx = int(len(images) * train_ratio)
        train_imgs = images[:split_idx]
        val_imgs = images[split_idx:]
        
        # Create train and val directories for this class
        train_class_dir = os.path.join(target_dir, "train", cls)
        val_class_dir = os.path.join(target_dir, "val", cls)
        
        os.makedirs(train_class_dir, exist_ok=True)
        os.makedirs(val_class_dir, exist_ok=True)
        
        # Copy images over
        for img in train_imgs:
            shutil.copy2(os.path.join(src_class_dir, img), os.path.join(train_class_dir, img))
            
        for img in val_imgs:
            shutil.copy2(os.path.join(src_class_dir, img), os.path.join(val_class_dir, img))
            
        print(f"Class '{cls}': Copied {len(train_imgs)} images to train, {len(val_imgs)} to val")
        
    print(f"\nDataset successfully prepared and structured at: {target_dir}")

if __name__ == "__main__":
    split_dataset()
