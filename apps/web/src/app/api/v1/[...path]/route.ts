import { apiHandler, notFound } from "@/server/http";

const unknownRoute = apiHandler(async () => {
  throw notFound("Unknown API route.");
});

export {
  unknownRoute as DELETE,
  unknownRoute as GET,
  unknownRoute as PATCH,
  unknownRoute as POST,
  unknownRoute as PUT,
};
