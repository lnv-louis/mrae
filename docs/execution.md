Model in execution testing: Quen-3-vl-2b

Models in familarity testing: 
- Method: OpenAI CLIP
Description: Original model trained on 400M image-text pairs; ResNet (RN50, RN101) or Vision Transformer (ViT-B/32, ViT-L/14) backbones.
Best For: General purpose benchmark, widely supported.

- Method: OpenCLIP
Description: Open-source implementation with larger, more accurate models (e.g., ViT-G, ViT-H) trained on LAION-5B.
Best For: High accuracy, research, state-of-the-art performance.

- Method: SigLIP
Description: Sigmoid Loss for Language Image Pre-training; replaces contrastive loss with sigmoid, improving performance and efficiency at same model size.
Best For: Higher accuracy per parameter than original CLIP.

- Method: MobileCLIP
Description: Developed by Apple; efficient image-text models optimized for low latency (3ms–15ms) and small size (50M–150M parameters).
Best For: Best for mobile apps (iOS/CoreML).

- Method: TinyCLIP
Description: Distilled CLIP mimicking larger models while being significantly smaller.
Best For: Resource-constrained devices where storage is tight.

- Method: CLIPA
Description: “Inverse CLIP” training that is faster and more effective to train; resulting models similar in use to standard CLIP.
Best For: Efficient training (research use).