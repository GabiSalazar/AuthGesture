import pickle
import numpy as np
from pathlib import Path

# Ruta al archivo .bin
#bin_file = Path(r"C:\Users\USER\Documents\biometric-gesture-system\backend\biometric_data\templates\2020_anatomical_1762270093099_6ad9d6ae.bin")
#bin_file = Path(r"C:\Users\USER\Documents\biometric-gesture-system\backend\biometric_data\templates\2020_dynamic_sequence_1762270134624_bb9a59cc.bin")

bin_file = Path(r"C:\Users\USER\Documents\biometric-gesture-system\backend\biometric_data\templates\2020_dynamic_1762270110832_303ba5e0.bin")

print(f"Archivo: {bin_file}")
print(f"Tamaño: {bin_file.stat().st_size} bytes")
print(f"Existe: {bin_file.exists()}")
print()

# Leer y deserializar
with open(bin_file, 'rb') as f:
    data = pickle.load(f)

print("="*60)
print("CONTENIDO DEL .BIN")
print("="*60)
print(f"Tipo raíz: {type(data)}")
print(f"Keys: {list(data.keys()) if isinstance(data, dict) else 'No es dict'}")
print()

if isinstance(data, dict):
    # Verificar si es formato nuevo
    if 'embeddings' in data:
        print("FORMATO NUEVO DETECTADO")
        print()
        print("METADATA:")
        for key, value in data.get('metadata', {}).items():
            print(f"   {key}: {value}")
        print()
        
        print("EMBEDDINGS:")
        embeddings = data['embeddings']
        for key, emb in embeddings.items():
            print(f"\n   {key}:")
            if emb is None:
                print(f"      None")
            elif isinstance(emb, np.ndarray):
                print(f"      Shape: {emb.shape}")
                print(f"      Dtype: {emb.dtype}")
                print(f"      Norma: {np.linalg.norm(emb):.6f}")
                print(f"      Min: {emb.min():.6f}")
                print(f"      Max: {emb.max():.6f}")
                print(f"      Primeros 5 valores: {emb[:5]}")
            else:
                print(f"      Tipo: {type(emb)}")
    else:
        print("FORMATO LEGACY (sin metadata)")
        print()
        for key, emb in data.items():
            print(f"\n   {key}:")
            if emb is None:
                print(f"      None")
            elif isinstance(emb, np.ndarray):
                print(f"      Shape: {emb.shape}")
                print(f"      Dtype: {emb.dtype}")
                print(f"      Norma: {np.linalg.norm(emb):.6f}")
                print(f"      Primeros 5 valores: {emb[:5]}")
            else:
                print(f"      Tipo: {type(emb)}")

print()
print("="*60)