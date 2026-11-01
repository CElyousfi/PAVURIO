# Política de privacidad

*Última actualización: 31 de octubre de 2026*

Pavurio es una aplicación para llevar el seguimiento del cuidado de tus mascotas. Esta política explica qué almacena la app, dónde lo hace y cómo eliminarlo. En resumen: **los datos de tus mascotas se guardan en tu teléfono, se conserva una copia de seguridad en tu cuenta de Pavurio para que puedas restaurarlos, y nunca vendemos datos ni mostramos publicidad.**

## Qué almacena Pavurio

**Lo que introduces.** Tus mascotas (nombre, especie, aspecto, cumpleaños, día de adopción), los cuidados que registras, rutinas y recordatorios, visitas al veterinario, pesos, historial de salud, momentos (títulos y descripciones) y los ajustes de la app.

- Se guarda **en tu teléfono**.
- Se guarda una **copia de seguridad** en tu cuenta de Pavurio (Google Firebase Cloud Firestore) para que puedas recuperarla tras cambiar o restablecer tu teléfono. Está vinculada a tu cuenta y solo tú puedes leerla.

**Las fotos y los archivos adjuntos** que añades a los registros y momentos se quedan **únicamente en tu teléfono**. No se suben a ningún servidor.

**Tu cuenta (Firebase Authentication).**

- Cada instalación recibe automáticamente un ID de cuenta aleatorio, de modo que tus datos tienen copia de seguridad desde el principio.
- Si decides guardar tu cuenta, también almacenamos la **dirección de correo electrónico** del método de inicio de sesión que elijas: Google, Iniciar sesión con Apple, o correo electrónico y contraseña.
- Las direcciones de correo electrónico usadas con contraseña se confirman mediante un código de 6 dígitos que te enviamos por correo. El código se almacena únicamente de forma cifrada (hash) y caduca a los 10 minutos. El restablecimiento de contraseña funciona de la misma manera.
- Con Iniciar sesión con Apple puedes ocultar tu correo electrónico; en ese caso, Apple nos proporciona una dirección de retransmisión privada.
- No te pedimos tu nombre.

**Informes de fallos (Firebase Crashlytics).**

- Si la app falla, se envía un informe con detalles técnicos: modelo del dispositivo, versión del sistema y de la app, y qué estaba haciendo la app en ese momento.
- Está vinculado al ID de cuenta aleatorio, nunca a los datos de tus mascotas.
- Puedes desactivarlo en **Ajustes → Cuenta → Compartir informes de fallos**.

**Compras.**

- Pavurio Pro se compra a través del App Store o de Google Play; nunca vemos tus datos de pago.
- Para saber si Pro está activo, usamos **RevenueCat**, que recibe tu ID de cuenta aleatorio y tus recibos de compra.

**Correos electrónicos que te enviamos.**

- Enviamos correos relacionados con la cuenta: códigos de inicio de sesión y códigos de restablecimiento de contraseña.
- Enviamos consejos y novedades **solo si marcas la casilla** al crear tu cuenta. Puedes darte de baja de cualquier boletín con un solo clic.
- Los correos se envían a través de **Resend**, que recibe tu dirección de correo electrónico y el mensaje.

**Notificaciones.** Los recordatorios se programan en tu teléfono; no se nos envía ningún contenido de los recordatorios.

## Qué no hace Pavurio

- Sin publicidad y sin SDK publicitarios.
- Sin venta ni cesión de datos personales.
- Sin rastreo a través de otras aplicaciones o sitios web.
- Sin SDK de analítica. Pavurio no ofrece consejos médicos.

## Quién trata los datos por nosotros

| Servicio | Finalidad | Datos |
|---|---|---|
| Google Firebase (Authentication, Cloud Firestore, Cloud Functions, Crashlytics) | cuenta, códigos por correo electrónico, copia de seguridad, informes de fallos | ID de cuenta, correo electrónico de inicio de sesión, elección sobre el boletín, copia de seguridad, informes de fallos |
| Resend | envío de los correos con códigos y, si lo aceptas, del boletín | dirección de correo electrónico, contenido del mensaje |
| RevenueCat | verificación de Pavurio Pro | ID de cuenta, recibos de compra |
| Apple / Google | inicio de sesión, pagos, distribución de la app | según se describe en sus propias políticas |

Estos proveedores pueden tratar los datos fuera de tu país (por ejemplo, en Estados Unidos) con arreglo a sus condiciones estándar de protección de datos.

## Cuánto tiempo los conservamos

- Tu copia de seguridad y tu cuenta se conservan mientras exista tu cuenta.
- Crashlytics conserva los informes de fallos durante un máximo de 90 días.
- Eliminar tu cuenta elimina de inmediato tu cuenta y tu copia de seguridad.

## Eliminar tus datos

- **En la app:** Ajustes → Cuenta → **Eliminar cuenta**. Esto elimina tu cuenta, tu copia de seguridad y los datos de tu teléfono.
- **Sin la app:** consulta [Eliminar tu cuenta](delete-account.html).
- **Solo los datos de tu teléfono:** Ajustes → Tus datos → Borrar todo, o desinstala la app.
- **Exportar:** puedes exportar todo en cualquier momento (Ajustes → Tus datos → CSV / JSON).

## Tus derechos

Puedes solicitar el acceso, la rectificación, la exportación o la eliminación de tus datos personales, u oponerte a su uso, escribiendo a **lesepavistespro@gmail.com**. Si te encuentras en la UE/EEE o en el Reino Unido, también puedes presentar una reclamación ante tu autoridad de protección de datos.

## Menores

Pavurio no está dirigida a menores de 13 años (16 en la UE) y no recopilamos sus datos de forma consciente.

## Cambios

Actualizaremos esta página y su fecha si algo cambia. Los cambios importantes también se mostrarán en la app.

**Contacto:** lesepavistespro@gmail.com
