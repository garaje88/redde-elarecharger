import type { Metadata } from "next";
import Link from "next/link";
import { DATA_CONTROLLER, PRIVACY_UPDATED_ON, PRIVACY_VERSION } from "@/lib/legal";
import { LegalSection } from "../legal-section";

export const metadata: Metadata = { title: "Aviso de privacidad" };

const PROCESSORS = [
  ["Supabase", "base de datos e inicio de sesión"],
  ["Cloudflare", "alojamiento de la aplicación"],
  ["Google", "inicio de sesión con tu cuenta"],
  ["OpenRouteService (HeiGIT)", "cálculo de rutas y búsqueda de direcciones"],
  ["OpenFreeMap / MapTiler", "imágenes del mapa"],
  [
    "Anthropic",
    "IA: buscar y leer fichas técnicas, leer fotos de recargas y responder al asistente",
  ],
  ["Sentry", "registro de errores, sin correo ni coordenadas"],
] as const;

export default function PrivacyPage() {
  const contact = DATA_CONTROLLER.contactEmail;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold">Aviso de privacidad</h1>
        <p className="text-sm text-muted-foreground">
          Versión {PRIVACY_VERSION} · actualizado el {PRIVACY_UPDATED_ON}
        </p>
      </div>

      <LegalSection title="Quién trata tus datos">
        <p>
          {DATA_CONTROLLER.name} es responsable del tratamiento de tus datos personales, según la
          Ley 1581 de 2012 y el Decreto 1377 de 2013.{" "}
          {contact ? (
            <>
              Para cualquier solicitud escríbenos a{" "}
              <a href={`mailto:${contact}`} className="text-primary underline underline-offset-2">
                {contact}
              </a>
              .
            </>
          ) : (
            "El canal de contacto se publicará antes del lanzamiento."
          )}
        </p>
      </LegalSection>

      <LegalSection title="Qué datos guardamos">
        <ul className="list-disc pl-5">
          <li>De tu cuenta Google: nombre, correo y foto.</li>
          <li>Tu garaje: vehículos, cargadores y la tarifa de energía que escribas.</li>
          <li>
            Tus trayectos guardados: origen, destino y resultados. El recorrido completo solo se
            guarda si lo permites en Ajustes.
          </li>
          <li>Tus cálculos de carga y las recargas que registres.</li>
          <li>
            Fichas técnicas y fotos de recargas que subas para la IA: borramos el archivo apenas lo
            leemos (a más tardar en 24 horas) y guardamos solo los datos extraídos.
          </li>
          <li>
            Tus conversaciones con el asistente, si lo permites en Ajustes. Al asistente no le
            enviamos tu nombre ni tu correo.
          </li>
          <li>
            Eventos de seguridad: inicios y cierres de sesión, exportación y borrado de cuenta.
          </li>
        </ul>
        <p>
          El origen y el destino de tus trayectos dicen dónde estás: los tratamos con especial
          cuidado, solo los ves tú y nunca los vendemos ni los compartimos con fines comerciales.
        </p>
      </LegalSection>

      <LegalSection title="Para qué los usamos">
        <p>
          Solo para prestarte el servicio: calcular consumo y tiempos de carga, guardar tu historial
          y tus estadísticas, proteger tu cuenta y corregir errores. No hacemos publicidad ni
          perfiles comerciales.
        </p>
      </LegalSection>

      <LegalSection title="Con quién los compartimos">
        <p>
          Con proveedores que procesan datos por nuestra cuenta, algunos fuera de Colombia, con
          garantías de seguridad y confidencialidad:
        </p>
        <ul className="list-disc pl-5">
          {PROCESSORS.map(([name, purpose]) => (
            <li key={name}>
              <strong>{name}</strong>: {purpose}.
            </li>
          ))}
        </ul>
        <p>
          Al buscar una ruta, enviamos las coordenadas de origen y destino a OpenRouteService, sin
          tu nombre ni tu correo.
        </p>
      </LegalSection>

      <LegalSection title="Tus derechos">
        <p>
          Puedes conocer, actualizar, rectificar y suprimir tus datos, revocar esta autorización,
          pedir prueba de ella y presentar quejas ante la Superintendencia de Industria y Comercio.
          Desde{" "}
          <Link href="/settings" className="text-primary underline underline-offset-2">
            Ajustes
          </Link>{" "}
          puedes descargar todos tus datos o borrar tu cuenta en cualquier momento; el borrado es
          inmediato y definitivo.
        </p>
      </LegalSection>

      <LegalSection title="Cuánto tiempo los guardamos">
        <p>
          Mientras tengas cuenta. Al borrarla eliminamos tus datos; solo queda el registro de que la
          cuenta se borró, sin datos que te identifiquen.
        </p>
      </LegalSection>

      <LegalSection title="Seguridad">
        <p>
          Tus datos viajan cifrados, cada usuario solo puede leer sus propios registros y el acceso
          es exclusivamente con tu cuenta Google.
        </p>
      </LegalSection>

      <Link href="/login" className="text-primary underline-offset-2 hover:underline">
        Volver
      </Link>
    </main>
  );
}
