# # import sys
# # from pathlib import Path
# # sys.path.insert(0, str(Path(__file__).parent))

# # from app.core.biometric_database import BiometricDatabase

# # # Inicializar con Supabase habilitado
# # db = BiometricDatabase(use_supabase=True)

# # # Probar con un usuario que sabes que existe
# # user = db.get_user("user_gabriela_1764549815644_9ed0ac86")

# # if user:
# #     print(f"Usuario encontrado:")
# #     print(f"  ID: {user.user_id}")
# #     print(f"  Username: {user.username}")
# #     print(f"  Email: {user.email}")
# #     print(f"  Templates A: {len(user.anatomical_templates)}")
# #     print(f"  Templates D: {len(user.dynamic_templates)}")
# # else:
# #     print("Usuario NO encontrado")



# import sys
# from pathlib import Path
# sys.path.insert(0, str(Path(__file__).parent))

# from app.core.biometric_database import BiometricDatabase

# # Inicializar con Supabase habilitado
# db = BiometricDatabase(use_supabase=True)

# # Probar usuario
# user_id = "user_gabriela_1764549815644_9ed0ac86"
# user = db.get_user(user_id)

# if user:
#     print(f"\nUsuario encontrado:")
#     print(f"  ID: {user.user_id}")
#     print(f"  Username: {user.username}")
#     print(f"  Email: {user.email}")
    
#     # Probar templates
#     templates = db.list_user_templates(user_id)
#     print(f"\nTemplates encontrados: {len(templates)}")
    
#     anatomical = [t for t in templates if t.anatomical_embedding is not None]
#     dynamic = [t for t in templates if t.dynamic_embedding is not None]
    
#     print(f"  Anatomicos: {len(anatomical)}")
#     print(f"  Dinamicos: {len(dynamic)}")
    
#     # Mostrar primeros 3 templates
#     print(f"\nPrimeros 3 templates:")
#     for i, template in enumerate(templates[:3], 1):
#         print(f"  {i}. {template.template_id}")
#         print(f"     Tipo: {template.template_type}")
#         print(f"     Gesto: {template.gesture_name}")
#         print(f"     Calidad: {template.quality_score}")
#         if template.anatomical_embedding is not None:
#             print(f"     Anatomical embedding: {template.anatomical_embedding.shape}")
#         if template.dynamic_embedding is not None:
#             print(f"     Dynamic embedding: {template.dynamic_embedding.shape}")
# else:
#     print("Usuario NO encontrado")


"""
Test rapido de integracion con Supabase
Prueba todos los metodos modificados
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.biometric_database import BiometricDatabase, PersonalityProfile

print("=" * 80)
print("TEST DE INTEGRACION SUPABASE")
print("=" * 80)

# Inicializar con Supabase
db = BiometricDatabase(use_supabase=True)

# TEST 1: list_users()
print("\n1. Listando usuarios...")
users = db.list_users()
print(f"   Usuarios encontrados: {len(users)}")
if users:
    print(f"   Primer usuario: {users[0].username} ({users[0].email})")

# TEST 2: get_user()
if users:
    test_user_id = users[0].user_id
    print(f"\n2. Obteniendo usuario especifico: {test_user_id}")
    user = db.get_user(test_user_id)
    if user:
        print(f"   OK - Usuario: {user.username}")
        print(f"   Email: {user.email}")
        print(f"   Templates: {len(user.anatomical_templates)} A, {len(user.dynamic_templates)} D")
    else:
        print("   ERROR - Usuario no encontrado")

    # TEST 3: list_user_templates()
    print(f"\n3. Obteniendo templates del usuario...")
    templates = db.list_user_templates(test_user_id)
    print(f"   Templates encontrados: {len(templates)}")
    
    if templates:
        anatomical_count = sum(1 for t in templates if t.anatomical_embedding is not None)
        dynamic_count = sum(1 for t in templates if t.dynamic_embedding is not None)
        print(f"   Con anatomical embedding: {anatomical_count}")
        print(f"   Con dynamic embedding: {dynamic_count}")
        
        # Verificar primer template
        template = templates[0]
        print(f"\n   Primer template:")
        print(f"     ID: {template.template_id}")
        print(f"     Tipo: {template.template_type}")
        print(f"     Gesto: {template.gesture_name}")
        if template.anatomical_embedding is not None:
            print(f"     Anatomical shape: {template.anatomical_embedding.shape}")
        if template.dynamic_embedding is not None:
            print(f"     Dynamic shape: {template.dynamic_embedding.shape}")
        if 'bootstrap_features' in template.metadata:
            print(f"     Bootstrap features: SI ({len(template.metadata['bootstrap_features'])} dims)")
        if 'temporal_sequence' in template.metadata:
            seq = template.metadata['temporal_sequence']
            if seq:
                print(f"     Temporal sequence: SI ({len(seq)} frames)")

    # TEST 4: has_personality_profile()
    print(f"\n4. Verificando perfil de personalidad...")
    has_personality = db.has_personality_profile(test_user_id)
    print(f"   Tiene perfil: {has_personality}")
    
    # TEST 5: get_personality_profile()
    if has_personality:
        print(f"\n5. Obteniendo perfil de personalidad...")
        personality = db.get_personality_profile(test_user_id)
        if personality:
            print(f"   OK - Respuestas: {personality.raw_responses}")
            print(f"   Extraversion: {personality.extraversion_1}, {personality.extraversion_2}")
        else:
            print("   ERROR - No se pudo obtener perfil")
    else:
        print(f"\n5. Usuario sin perfil de personalidad - creando uno de prueba...")
        test_personality = PersonalityProfile.from_responses(
            user_id=test_user_id,
            responses=[3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
        )
        
        success = db.store_personality_profile(test_personality)
        if success:
            print(f"   OK - Perfil creado")
            
            # Verificar que se guardo
            personality = db.get_personality_profile(test_user_id)
            if personality:
                print(f"   OK - Perfil recuperado: {personality.raw_responses}")
            else:
                print("   ERROR - No se pudo recuperar perfil")
        else:
            print("   ERROR - No se pudo crear perfil")

print("\n" + "=" * 80)
print("TEST COMPLETADO")
print("=" * 80)