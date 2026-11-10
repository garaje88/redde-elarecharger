# Elacharger — Guía de marca (v1, noviembre 2026)

## Idea
**e·ruta**: una "e" cuya barra sale del círculo y llega a un punto. Es el trayecto de A a B, el centro de la app. La "e" con punto evoca lo eléctrico sin recurrir al rayo.

## Versiones
| Archivo | Uso |
| --- | --- |
| `final-horizontal.svg` | Principal: encabezados web, documentos, presentaciones |
| `final-horizontal-color-dark.svg` | Sobre fondo Tinta: "e" y texto en Papel, punto en Voltio |
| `final-stacked.svg` / `-color-dark.svg` | Espacios cuadrados: splash, redes, material impreso |
| `final-symbol.svg` | Solo símbolo, desde 32 px |
| `final-symbol-small.svg` | Versión pequeña (barra corta, punto más grande): menos de 32 px |
| `final-symbol-volt.svg` | Símbolo en Voltio sobre Tinta (ícono de app) |
| `dist/symbol/` | favicon.ico, favicon.svg, íconos PWA, apple-touch-icon, `site.webmanifest`, `head-snippet.html` |
| `dist/*/…-black / -white / -mono-3f5a00` | Una tinta: negro, blanco, Voltio oscuro |

## Color
| Nombre | HEX | RGB | Uso |
| --- | --- | --- | --- |
| Tinta | `#0E1116` | 14 17 22 | Logo principal, texto, fondos oscuros |
| Voltio | `#C8F031` | 200 240 49 | Acento de marca: solo sobre Tinta o en superficies grandes; nunca texto sobre blanco |
| Voltio oscuro | `#3F5A00` | 63 90 0 | Botones, enlaces y acentos sobre fondos claros (texto blanco encima) |
| Papel | `#F5F6F1` | 245 246 241 | Fondo claro de la app |
| Grafito | `#5B6470` | 91 100 112 | Texto secundario |
| Voltio claro | `#F1F8D9` | 241 248 217 | Fondos de resultados positivos |

Contraste: Voltio sobre Tinta y Tinta sobre Papel superan con amplitud el mínimo AA. Voltio sobre blanco no lo cumple: por eso existe Voltio oscuro.

Equivalencias CMYK y Pantone: pendientes de prueba de imprenta. No se listan para no inventarlas.

## Tipografía
- Logotipo: Inter Display SemiBold, minúsculas, tracking −2,5 %, convertido a curvas (licencia SIL OFL, permite uso en logo).
- Interfaz: Inter para texto y Space Grotesk para títulos y cifras grandes (ambas OFL, en Google Fonts).

## Espacio libre y tamaños mínimos
- Espacio libre alrededor del logo = el diámetro del punto del símbolo, por los cuatro lados.
- Símbolo: mínimo 16 px; por debajo de 32 px se usa `final-symbol-small.svg`.
- Logotipo horizontal: mínimo 120 px de ancho en pantalla y 30 mm en impreso.

## Fondos permitidos
- Papel, blanco o Tinta.
- Fotos solo con zona plana y oscura (Tinta al 80 % o más), usando la versión `-color-dark`.

## No hacer
- Cambiar los colores fuera de la paleta, ni poner el punto en otro color sobre fondo claro.
- Separar el punto de la "e", moverlo o agrandarlo (salvo la versión pequeña).
- Estirar, rotar, añadir sombras, degradados o contornos.
- Escribir "Elacharger" con otra fuente en lugar del logotipo.
- Poner Voltio como texto sobre fondos claros.

## Pendientes
- Búsqueda profesional de marca registrada (SIC en Colombia y bases internacionales) antes de publicar.
- Prueba de impresión para fijar CMYK y Pantone.
