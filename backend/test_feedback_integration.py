"""
Prueba de integración del servicio de feedback
"""
from app.services.authentication_feedback_service import get_feedback_service

print("🧪 Probando integración de feedback...")
print("-" * 50)

# Obtener servicio
try:
    service = get_feedback_service()
    print("Servicio obtenido correctamente")
except Exception as e:
    print(f"Error obteniendo servicio: {e}")
    exit(1)

# Simular guardado de intento
try:
    print("\nGuardando intento de prueba en Supabase...")
    
    result = service.save_authentication_attempt(
        session_id='test-session-123',
        user_id='user-test',
        username='Test User',
        mode='verification',
        system_decision='authenticated',
        confidence=0.95,
        ip_address='127.0.0.1',
        duration=2.5
    )
    
    print(f"Intento guardado exitosamente")
    print(f"   ID: {result['id']}")
    print(f"   Token: {result['feedback_token']}")
    
    # Guardar token para siguiente prueba
    test_token = result['feedback_token']
    
except Exception as e:
    print(f"Error guardando intento: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# Verificar que se guardó
try:
    print("\nVerificando que se guardó correctamente...")
    
    attempt = service.get_attempt_by_token(test_token)
    if attempt:
        print(f"Intento recuperado exitosamente")
        print(f"   Usuario: {attempt['username']}")
        print(f"   Modo: {attempt['mode']}")
        print(f"   Decisión: {attempt['system_decision']}")
        print(f"   Confianza: {attempt['confidence']}")
        print(f"   Feedback actual: {attempt.get('user_feedback', 'null')}")
    else:
        print(f"No se pudo recuperar el intento")
        exit(1)
        
except Exception as e:
    print(f"Error recuperando intento: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# Simular actualización de feedback
try:
    print("\n✏️ Simulando feedback del usuario...")
    
    success = service.update_user_feedback(test_token, 'was_me')
    
    if success:
        print(f"Feedback actualizado correctamente")
        
        # Verificar actualización
        updated_attempt = service.get_attempt_by_token(test_token)
        print(f"   Nuevo feedback: {updated_attempt.get('user_feedback', 'null')}")
        print(f"   Timestamp: {updated_attempt.get('feedback_timestamp', 'null')}")
    else:
        print(f"No se pudo actualizar el feedback")
        
except Exception as e:
    print(f"Error actualizando feedback: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 50)
print("¡Integración funcionando correctamente!")
print("=" * 50)