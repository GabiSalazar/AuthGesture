# from sendgrid import SendGridAPIClient
# from sendgrid.helpers.mail import Mail
# import os
# from dotenv import load_dotenv

# load_dotenv()

# api_key = os.getenv('SENDGRID_API_KEY')

# # PRUEBA 1: Con el dominio verificado
# print("=" * 60)
# print("PRUEBA 1: Con dominio verificado em6082")
# message1 = Mail(
#     from_email='noreply@em6082.authgesture.com',
#     to_emails='test@example.com',
#     subject='Test 1',
#     html_content='<p>Test con dominio verificado</p>'
# )

# try:
#     sg = SendGridAPIClient(api_key)
#     response = sg.send(message1)
#     print(f"✓ SUCCESS con em6082! Status: {response.status_code}")
# except Exception as e:
#     print(f"✗ ERROR con em6082: {e}")
#     if hasattr(e, 'body'):
#         print(f"   Detalles: {e.body}")

# # PRUEBA 2: Con dominio original
# print("\n" + "=" * 60)
# print("PRUEBA 2: Con dominio original authgesture.com")
# message2 = Mail(
#     from_email='noreply@authgesture.com',
#     to_emails='test@example.com',
#     subject='Test 2',
#     html_content='<p>Test con dominio original</p>'
# )

# try:
#     sg = SendGridAPIClient(api_key)
#     response = sg.send(message2)
#     print(f"✓ SUCCESS con authgesture.com! Status: {response.status_code}")
# except Exception as e:
#     print(f"✗ ERROR con authgesture.com: {e}")
#     if hasattr(e, 'body'):
#         print(f"   Detalles: {e.body}")
# print("=" * 60)

import resend
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configurar API key
resend.api_key = os.getenv('RESEND_API_KEY')

print("=" * 60)
print("TEST DE RESEND")
print("=" * 60)
print(f"API Key: {resend.api_key[:20]}..." if resend.api_key else "API Key: NO ENCONTRADA")
print("=" * 60)

# Enviar email de prueba
try:
    params = {
        "from": "SystemB <noreply@authgesture.com>",
        "to": ["gabriela.a.salazar.m@hotmail.com"],
        "subject": "Test de Resend - SystemB",
        "html": """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #00B8D4;">🎉 Test de Resend</h2>
            <p>Este es un email de prueba enviado desde <strong>SystemB</strong> usando Resend.</p>
            <p>Si recibes este email, ¡Resend está funcionando correctamente!</p>
            <hr style="border: 1px solid #E0F2FE; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Auth-Gesture Biometric System</p>
        </div>
        """
    }

    email = resend.Emails.send(params)
    
    print("✓ EMAIL ENVIADO EXITOSAMENTE!")
    print(f"✓ ID del email: {email['id']}")
    print(f"✓ Destinatario: gabriela.a.salazar.m@hotmail.com")
    print("\nRevisa tu bandeja de entrada (o spam) en Hotmail")
    
except Exception as e:
    print(f"✗ ERROR: {e}")
    print(f"✗ Tipo de error: {type(e).__name__}")

print("=" * 60)