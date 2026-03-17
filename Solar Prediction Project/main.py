import os

print("Collecting data...")
os.system("python src/data_collections.py")
print("------------------------------")

print("Preparing dataset...")
os.system("python src/prepare_dataset.py")
print("------------------------------")

print("Training model...")
os.system("python src/train_model.py")
print("------------------------------")

print("Generating predictions...")
os.system("python src/predict_solar.py")
print("------------------------------")

print("Pipeline completed successfully!")
print("------------------------------")