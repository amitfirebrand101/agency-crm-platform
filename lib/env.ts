type PublicEnv = {
  appName: string;
  appUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
};

function clean(value: string | undefined) {
  return value?.replace(/^["']|["']$/g, "");
}

const env = {
  appName: clean(process.env.NEXT_PUBLIC_APP_NAME) ?? "GoLowLevel",
  appUrl: clean(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000",
  supabaseUrl: clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
};

export function getPublicEnv(): PublicEnv {
  if (!env.supabaseUrl || !env.supabasePublishableKey) {
    throw new Error("Missing Supabase public environment variables.");
  }

  return {
    appName: env.appName,
    appUrl: env.appUrl,
    supabaseUrl: env.supabaseUrl,
    supabasePublishableKey: env.supabasePublishableKey
  };
}
