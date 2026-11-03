# Cómo arrancar Elacharger en Claude Code

1. Descomprime esta carpeta y ábrela como raíz del repositorio (`git init`).
2. Abre Claude Code en esa carpeta. Leerá `CLAUDE.md` automáticamente.
3. Ten a mano: proyecto de Supabase, cliente OAuth de Google, llave de OpenRouteService y, para la fase 8, llave de la API de Claude. Las llaves van en `.env.local`, nunca en el chat ni en git.
4. Antes de la fase 2, resuelve las preguntas abiertas de `docs/PLAN.md` (sección Fases).
5. Por cada fase: entra en modo plan (Shift+Tab), pega el prompt de la tabla de fases, revisa el plan, apruébalo y verifica el criterio de salida antes de pasar a la siguiente.

Primer mensaje sugerido:

> Lee CLAUDE.md y docs/PLAN.md completos, incluidos los diagramas de docs/diagrams y los mockups de docs/mockups. Resume en 10 líneas lo que vas a construir, lista las dudas que tengas y luego ejecuta la fase 0 de la tabla de fases.

Contenido:
- `CLAUDE.md`: reglas del proyecto para Claude Code.
- `docs/PLAN.md`: especificación completa (alcance, stack, fórmulas, catálogo, datos, seguridad, IA, fases).
- `docs/diagrams/`: arquitectura y componentes (PNG; también en Mermaid dentro del plan).
- `docs/mockups/`: 10 pantallas en HTML como guía visual.
- `docs/reference/`: ficha técnica de ejemplo (Deepal S05) para pruebas.
