# # # """
# # # Script de migracion SOLO USUARIOS
# # # """

# # # import sys
# # # import os
# # # from pathlib import Path

# # # backend_dir = Path(__file__).parent.parent
# # # sys.path.insert(0, str(backend_dir))

# # # import logging
# # # from datetime import datetime
# # # import time

# # # from app.core.biometric_database import BiometricDatabase
# # # from app.core.supabase_client import get_supabase_client

# # # logging.basicConfig(
# # #     level=logging.INFO,
# # #     format='%(asctime)s - %(levelname)s - %(message)s'
# # # )
# # # logger = logging.getLogger(__name__)


# # # def migrate_users():
# # #     """Migra solo usuarios."""
# # #     try:
# # #         logger.info("=" * 80)
# # #         logger.info("MIGRANDO SOLO USUARIOS")
# # #         logger.info("=" * 80)
        
# # #         # Conectar
# # #         supabase = get_supabase_client()
# # #         local_db = BiometricDatabase(use_supabase=False)
        
# # #         users = local_db.list_users()
# # #         logger.info(f"Usuarios encontrados: {len(users)}")
        
# # #         migrated = 0
# # #         failed = 0
        
# # #         for i, user in enumerate(users, 1):
# # #             try:
# # #                 logger.info(f"\n[{i}/{len(users)}] Usuario: {user.user_id}")
# # #                 logger.info(f"   Username: {user.username}")
# # #                 logger.info(f"   Email: {getattr(user, 'email', 'N/A')}")
# # #                 logger.info(f"   Phone: {getattr(user, 'phone_number', 'N/A')}")
# # #                 logger.info(f"   Age: {getattr(user, 'age', 'N/A')}")
# # #                 logger.info(f"   Gender: {getattr(user, 'gender', 'N/A')}")
                
# # #                 # VALIDACIONES CRITICAS
# # #                 email = getattr(user, 'email', None)
# # #                 phone = getattr(user, 'phone_number', None)
# # #                 age = getattr(user, 'age', None)
# # #                 gender = getattr(user, 'gender', None)
                
# # #                 if not email:
# # #                     logger.error(f"   FALTA EMAIL - OMITIENDO")
# # #                     failed += 1
# # #                     continue
                
# # #                 if not phone:
# # #                     logger.error(f"   FALTA TELEFONO - OMITIENDO")
# # #                     failed += 1
# # #                     continue
                
# # #                 if not age:
# # #                     logger.error(f"   FALTA EDAD - OMITIENDO")
# # #                     failed += 1
# # #                     continue
                
# # #                 if not gender:
# # #                     logger.error(f"   FALTA GENERO - OMITIENDO")
# # #                     failed += 1
# # #                     continue
                
# # #                 # Preparar datos
# # #                 # Preparar datos
# # #                 user_data = {
# # #                     'user_id': user.user_id,
# # #                     'username': user.username,
# # #                     'email': email,
# # #                     'phone_number': phone,
# # #                     'age': int(age),
# # #                     'gender': gender,
# # #                     'gesture_sequence': user.gesture_sequence or [],
# # #                     'anatomical_templates': user.anatomical_templates or [],
# # #                     'dynamic_templates': user.dynamic_templates or [],
# # #                     'multimodal_templates': user.multimodal_templates or [],
                    
# # #                     # AGREGAR ESTOS CAMPOS:
# # #                     'email_verified': getattr(user, 'email_verified', False),
# # #                     'sequence_metadata': getattr(user, 'sequence_metadata', {}),
# # #                     'failed_attempts': getattr(user, 'failed_attempts', 0),
# # #                     'last_failed_timestamp': datetime.fromtimestamp(user.last_failed_timestamp).isoformat() if hasattr(user, 'last_failed_timestamp') and user.last_failed_timestamp else None,
# # #                     'lockout_until': datetime.fromtimestamp(user.lockout_until).isoformat() if hasattr(user, 'lockout_until') and user.lockout_until else None,
# # #                     'lockout_history': getattr(user, 'lockout_history', []),
                    
# # #                     'total_enrollments': getattr(user, 'total_enrollments', 0),
# # #                     'total_verifications': getattr(user, 'total_verifications', 0),
# # #                     'successful_verifications': getattr(user, 'successful_verifications', 0),
# # #                     'quality_threshold': getattr(user, 'quality_threshold', 0.7),
# # #                     'security_level': getattr(user, 'security_level', 'standard'),
# # #                     'last_activity': datetime.fromtimestamp(getattr(user, 'last_activity', time.time())).isoformat(),
# # #                     'created_at': datetime.fromtimestamp(user.created_at).isoformat() if hasattr(user, 'created_at') else datetime.now().isoformat(),
# # #                     'updated_at': datetime.now().isoformat(),
# # #                     'metadata': user.metadata if hasattr(user, 'metadata') else {}
# # #                 }
                
# # #                 logger.info(f"   Datos validados OK")
                
# # #                 # Verificar si existe
# # #                 existing = supabase.table('user_profiles')\
# # #                     .select('id')\
# # #                     .eq('user_id', user.user_id)\
# # #                     .execute()
                
# # #                 if existing.data:
# # #                     # UPDATE
# # #                     supabase.table('user_profiles')\
# # #                         .update(user_data)\
# # #                         .eq('user_id', user.user_id)\
# # #                         .execute()
# # #                     logger.info(f"   ACTUALIZADO")
# # #                 else:
# # #                     # INSERT
# # #                     supabase.table('user_profiles')\
# # #                         .insert(user_data)\
# # #                         .execute()
# # #                     logger.info(f"   CREADO")
                
# # #                 migrated += 1
                
# # #             except Exception as e:
# # #                 logger.error(f"   ERROR: {e}")
# # #                 import traceback
# # #                 logger.error(traceback.format_exc())
# # #                 failed += 1
# # #                 continue
        
# # #         logger.info("\n" + "=" * 80)
# # #         logger.info("RESUMEN")
# # #         logger.info("=" * 80)
# # #         logger.info(f"Migrados: {migrated}")
# # #         logger.info(f"Fallidos: {failed}")
# # #         logger.info("=" * 80)
        
# # #     except Exception as e:
# # #         logger.error(f"ERROR GENERAL: {e}")
# # #         import traceback
# # #         traceback.print_exc()


# # # if __name__ == "__main__":
# # #     migrate_users()




# # """
# # Script de migracion SOLO TEMPLATES
# # Lee JSON + BIN y migra a Supabase
# # """

# # import sys
# # import os
# # from pathlib import Path

# # backend_dir = Path(__file__).parent.parent
# # sys.path.insert(0, str(backend_dir))

# # import logging
# # from datetime import datetime
# # import time
# # import numpy as np

# # from app.core.biometric_database import BiometricDatabase, TemplateType
# # from app.core.supabase_client import get_supabase_client

# # logging.basicConfig(
# #     level=logging.INFO,
# #     format='%(asctime)s - %(levelname)s - %(message)s'
# # )
# # logger = logging.getLogger(__name__)


# # def migrate_templates():
# #     """Migra solo templates."""
# #     try:
# #         logger.info("=" * 80)
# #         logger.info("MIGRANDO SOLO TEMPLATES")
# #         logger.info("=" * 80)
        
# #         # Conectar
# #         supabase = get_supabase_client()
# #         local_db = BiometricDatabase(use_supabase=False)
        
# #         templates = list(local_db.templates.values())
# #         logger.info(f"Templates encontrados: {len(templates)}")
        
# #         migrated = 0
# #         failed = 0
# #         skipped = 0
        
# #         for i, template in enumerate(templates, 1):
# #             try:
# #                 logger.info(f"\n[{i}/{len(templates)}] Template: {template.template_id}")
# #                 logger.info(f"   Usuario: {template.user_id}")
# #                 logger.info(f"   Tipo: {template.template_type}")
# #                 logger.info(f"   Gesto: {template.gesture_name}")
                
# #                 # Verificar embeddings
# #                 has_anatomical = template.anatomical_embedding is not None
# #                 has_dynamic = template.dynamic_embedding is not None
# #                 logger.info(f"   Embeddings en memoria: A={has_anatomical}, D={has_dynamic}")
                
# #                 # Bootstrap check
# #                 is_bootstrap = template.metadata.get('bootstrap_mode', False)
# #                 if is_bootstrap:
# #                     logger.info(f"   BOOTSTRAP MODE")
                
# #                 # Convertir embeddings a listas
# #                 anatomical_list = None
# #                 dynamic_list = None
                
# #                 if has_anatomical:
# #                     anatomical_list = template.anatomical_embedding.tolist()
# #                     logger.info(f"   Anatomical: {len(anatomical_list)} dims")
                
# #                 if has_dynamic:
# #                     dynamic_list = template.dynamic_embedding.tolist()
# #                     logger.info(f"   Dynamic: {len(dynamic_list)} dims")
                
# #                 # Verificar metadata critica
# #                 if 'bootstrap_features' in template.metadata:
# #                     logger.info(f"   Bootstrap features: {len(template.metadata['bootstrap_features'])} dims")
                
# #                 if 'temporal_sequence' in template.metadata:
# #                     seq = template.metadata['temporal_sequence']
# #                     if seq:
# #                         logger.info(f"   Temporal sequence: {len(seq)} frames")
                
# #                 if template.metadata.get('is_sequence'):
# #                     logger.info(f"   FLUID SEQUENCE: {template.metadata.get('sequence_frames', 0)} frames")
                
# #                 # Preparar datos
# #                 template_data = {
# #                     'template_id': template.template_id,
# #                     'user_id': template.user_id,
# #                     'template_type': template.template_type.value if hasattr(template.template_type, 'value') else str(template.template_type),
# #                     'anatomical_embedding': anatomical_list,
# #                     'dynamic_embedding': dynamic_list,
# #                     'gesture_name': template.gesture_name,
# #                     'hand_side': getattr(template, 'hand_side', 'unknown'),
# #                     'quality_score': float(template.quality_score) if template.quality_score is not None else None,
# #                     'confidence': float(template.confidence) if template.confidence is not None else None,
# #                     'enrollment_session': template.enrollment_session if hasattr(template, 'enrollment_session') else '',
# #                     'created_at': datetime.fromtimestamp(template.created_at).isoformat() if hasattr(template, 'created_at') else datetime.now().isoformat(),
# #                     'updated_at': datetime.now().isoformat(),
# #                     'checksum': getattr(template, 'checksum', ''),
# #                     'verification_count': getattr(template, 'verification_count', 0),
# #                     'success_count': getattr(template, 'success_count', 0),
# #                     'metadata': template.metadata if hasattr(template, 'metadata') else {}
# #                 }
                
# #                 logger.info(f"   Datos preparados")
                
# #                 # Verificar si ya existe
# #                 existing = supabase.table('biometric_templates')\
# #                     .select('id')\
# #                     .eq('template_id', template.template_id)\
# #                     .execute()
                
# #                 if existing.data:
# #                     logger.info(f"   YA EXISTE - omitiendo")
# #                     skipped += 1
# #                 else:
# #                     # INSERT
# #                     supabase.table('biometric_templates')\
# #                         .insert(template_data)\
# #                         .execute()
# #                     logger.info(f"   CREADO")
# #                     migrated += 1
                
# #             except Exception as e:
# #                 logger.error(f"   ERROR: {e}")
# #                 import traceback
# #                 logger.error(traceback.format_exc())
# #                 failed += 1
# #                 continue
        
# #         logger.info("\n" + "=" * 80)
# #         logger.info("RESUMEN")
# #         logger.info("=" * 80)
# #         logger.info(f"Migrados: {migrated}")
# #         logger.info(f"Omitidos: {skipped}")
# #         logger.info(f"Fallidos: {failed}")
# #         logger.info("=" * 80)
        
# #     except Exception as e:
# #         logger.error(f"ERROR GENERAL: {e}")
# #         import traceback
# #         traceback.print_exc()


# # if __name__ == "__main__":
# #     migrate_templates()


# """
# Script de migracion SOLO PERFILES DE PERSONALIDAD
# """

# import sys
# from pathlib import Path

# backend_dir = Path(__file__).parent.parent
# sys.path.insert(0, str(backend_dir))

# import logging
# from datetime import datetime

# from app.core.biometric_database import BiometricDatabase
# from app.core.supabase_client import get_supabase_client

# logging.basicConfig(
#     level=logging.INFO,
#     format='%(asctime)s - %(levelname)s - %(message)s'
# )
# logger = logging.getLogger(__name__)


# def migrate_personalities():
#     """Migra perfiles de personalidad."""
#     try:
#         logger.info("=" * 80)
#         logger.info("MIGRANDO PERSONALITY PROFILES")
#         logger.info("=" * 80)
        
#         # Conectar
#         supabase = get_supabase_client()
#         local_db = BiometricDatabase(use_supabase=False)
        
#         # Obtener archivos de personalidad
#         personality_dir = local_db.db_path / "personality_profiles"
        
#         if not personality_dir.exists():
#             logger.info("No hay directorio de personality_profiles")
#             return
        
#         profile_files = list(personality_dir.glob("*.json"))
#         logger.info(f"Perfiles encontrados: {len(profile_files)}")
        
#         migrated = 0
#         failed = 0
#         skipped = 0
#         orphaned = 0
        
#         for i, profile_file in enumerate(profile_files, 1):
#             try:
#                 user_id = profile_file.stem
#                 logger.info(f"\n[{i}/{len(profile_files)}] Perfil: {user_id}")
                
#                 # Verificar que el usuario existe en Supabase
#                 user_check = supabase.table('user_profiles')\
#                     .select('id')\
#                     .eq('user_id', user_id)\
#                     .execute()
                
#                 if not user_check.data:
#                     logger.warning(f"   Usuario NO existe en Supabase - OMITIENDO")
#                     orphaned += 1
#                     continue
                
#                 # Cargar perfil desde local
#                 profile = local_db.get_personality_profile(user_id)
                
#                 if not profile:
#                     logger.warning(f"   No se pudo cargar perfil")
#                     failed += 1
#                     continue
                
#                 logger.info(f"   Respuestas: {profile.raw_responses}")
                
#                 # Preparar datos
#                 profile_data = {
#                     'user_id': profile.user_id,
#                     'extraversion_1': profile.extraversion_1,
#                     'agreeableness_1': profile.agreeableness_1,
#                     'conscientiousness_1': profile.conscientiousness_1,
#                     'neuroticism_1': profile.neuroticism_1,
#                     'openness_1': profile.openness_1,
#                     'extraversion_2': profile.extraversion_2,
#                     'agreeableness_2': profile.agreeableness_2,
#                     'conscientiousness_2': profile.conscientiousness_2,
#                     'neuroticism_2': profile.neuroticism_2,
#                     'openness_2': profile.openness_2,
#                     'raw_responses': profile.raw_responses,
#                     'completed_at': profile.completed_at if hasattr(profile, 'completed_at') else datetime.now().isoformat(),
#                     'version': profile.version if hasattr(profile, 'version') else '1.0'
#                 }
                
#                 # Verificar si ya existe
#                 existing = supabase.table('personality_profiles')\
#                     .select('id')\
#                     .eq('user_id', user_id)\
#                     .execute()
                
#                 if existing.data:
#                     logger.info(f"   YA EXISTE - omitiendo")
#                     skipped += 1
#                 else:
#                     # INSERT
#                     supabase.table('personality_profiles')\
#                         .insert(profile_data)\
#                         .execute()
#                     logger.info(f"   CREADO")
#                     migrated += 1
                
#             except Exception as e:
#                 logger.error(f"   ERROR: {e}")
#                 import traceback
#                 logger.error(traceback.format_exc())
#                 failed += 1
#                 continue
        
#         logger.info("\n" + "=" * 80)
#         logger.info("RESUMEN")
#         logger.info("=" * 80)
#         logger.info(f"Migrados: {migrated}")
#         logger.info(f"Omitidos (ya existen): {skipped}")
#         logger.info(f"Huerfanos (usuario no existe): {orphaned}")
#         logger.info(f"Fallidos: {failed}")
#         logger.info("=" * 80)
        
#     except Exception as e:
#         logger.error(f"ERROR GENERAL: {e}")
#         import traceback
#         traceback.print_exc()


# if __name__ == "__main__":
#     migrate_personalities()


"""
Script de migracion SOLO EMAIL VERIFICATIONS
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import logging
import json
from datetime import datetime

from app.core.biometric_database import BiometricDatabase
from app.core.supabase_client import get_supabase_client

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def migrate_email_verifications():
    """Migra verificaciones de email."""
    try:
        logger.info("=" * 80)
        logger.info("MIGRANDO EMAIL VERIFICATIONS")
        logger.info("=" * 80)
        
        # Conectar
        supabase = get_supabase_client()
        local_db = BiometricDatabase(use_supabase=False)
        
        # Obtener archivos de email verifications
        email_dir = local_db.db_path / "email_verifications"
        
        if not email_dir.exists():
            logger.info("No hay directorio de email_verifications")
            return
        
        verification_files = list(email_dir.glob("*.json"))
        logger.info(f"Verificaciones encontradas: {len(verification_files)}")
        
        migrated = 0
        failed = 0
        skipped = 0
        orphaned = 0
        
        for i, verification_file in enumerate(verification_files, 1):
            try:
                user_id = verification_file.stem
                logger.info(f"\n[{i}/{len(verification_files)}] Verificacion: {user_id}")
                
                # Verificar que el usuario existe en Supabase
                user_check = supabase.table('user_profiles')\
                    .select('id')\
                    .eq('user_id', user_id)\
                    .execute()
                
                if not user_check.data:
                    logger.warning(f"   Usuario NO existe en Supabase - OMITIENDO")
                    orphaned += 1
                    continue
                
                # Cargar verificacion desde archivo
                with open(verification_file, 'r', encoding='utf-8') as f:
                    verification_data_local = json.load(f)
                
                logger.info(f"   Email: {verification_data_local.get('email')}")
                logger.info(f"   Verified: {verification_data_local.get('verified', False)}")
                
                # Preparar datos para Supabase
                verification_data = {
                    'user_id': verification_data_local['user_id'],
                    'email': verification_data_local['email'],
                    'otp_code': verification_data_local.get('token', '000000'),
                    'is_verified': verification_data_local.get('verified', False),
                    'attempts': verification_data_local.get('attempts', 0),
                    'max_attempts': verification_data_local.get('max_attempts', 3),
                    'created_at': verification_data_local.get('created_at', datetime.now().isoformat()),
                    'expires_at': verification_data_local.get('expires_at', datetime.now().isoformat()),
                    'verified_at': verification_data_local.get('verification_date', None),
                    'ip_address': None,
                    'user_agent': None
                }
                
                # Verificar si ya existe
                existing = supabase.table('email_verifications')\
                    .select('id')\
                    .eq('user_id', user_id)\
                    .execute()
                
                if existing.data:
                    logger.info(f"   YA EXISTE - omitiendo")
                    skipped += 1
                else:
                    # INSERT
                    supabase.table('email_verifications')\
                        .insert(verification_data)\
                        .execute()
                    logger.info(f"   CREADO")
                    migrated += 1
                
            except Exception as e:
                logger.error(f"   ERROR: {e}")
                import traceback
                logger.error(traceback.format_exc())
                failed += 1
                continue
        
        logger.info("\n" + "=" * 80)
        logger.info("RESUMEN")
        logger.info("=" * 80)
        logger.info(f"Migrados: {migrated}")
        logger.info(f"Omitidos (ya existen): {skipped}")
        logger.info(f"Huerfanos (usuario no existe): {orphaned}")
        logger.info(f"Fallidos: {failed}")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"ERROR GENERAL: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    migrate_email_verifications()