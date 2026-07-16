import { createSupabaseBrowserClient } from "@/infrastructure/db/supabase-browser";

export async function signInAdministrator(
  email: string,
  password: string,
): Promise<void> {
  const client = createSupabaseBrowserClient();
  if (!client) {
    throw new Error(
      "Supabase no está configurado. Añade las variables de entorno para activar el acceso de administrador.",
    );
  }
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOutAdministrator(): Promise<void> {
  const client = createSupabaseBrowserClient();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw new Error(error.message);
}
