# GameTracker 

Un proyecto de Lotso Studios diseñado para descubrir, rastrear y gestionar tu colección de videojuegos de forma rápida y eficiente. 

GameTracker nace como una evolución de nuestros sistemas de seguimiento anteriores, adaptando la experiencia de usuario exclusivamente al mundo del gaming. A diferencia de arquitecturas web más pesadas, esta iteración destaca por utilizar un cliente web construido enteramente en HTML, obteniendo toda la información de títulos, carátulas y detalles técnicos en tiempo real mediante la RAWG API.

## 🚀 Características Principales

*   **Exploración de Catálogo:** Búsqueda exhaustiva de videojuegos, desde lanzamientos AAA hasta joyas indie, impulsada por la base de datos de RAW.
*   **Cliente Ultra Ligero:** Interfaz de usuario desarrollada en HTML puro (junto con Vanilla JS/CSS), lo que garantiza tiempos de carga mínimos y cero dependencias de frameworks en el frontend.
*   **Detalles Completos:** Visualización de plataformas, fechas de lanzamiento, géneros, calificaciones y requisitos del sistema.
*   **Arquitectura Escalable:** Frontend desacoplado, listo para comunicarse de manera eficiente con nuestro entorno de microservicios y contenedores.

## 🛠️ Tecnologías Utilizadas

*   **Frontend:** HTML5, CSS3, JavaScript.
*   **Backend:** NodeJS.
*   **Proveedores de Datos:** RAWG Video Games Database API.
*   **Infraestructura:** Docker para despliegue.

### Pasos para ejecutar

1.  Clona este repositorio:
    ```bash
    git clone [https://github.com/tu-usuario/gametracker.git](https://github.com/tu-usuario/gametracker.git)
    ```
2.  Navega al directorio del proyecto:
    ```bash
    cd gametracker
    ```
3.  Configura tu API Key:
    *   Abre el archivo de configuración de JavaScript (por ejemplo, `config.js` o `api.js`).
    *   Reemplaza la variable `API_KEY` con tu clave personal de RAWG.
4.  Inicia tu servidor web local apuntando al archivo `index.html`.
5.  ¡Abre tu navegador y comienza a explorar!

## 📝 Licencia

Este proyecto es desarrollado bajo Lotso Studios. Todos los derechos reservados.
