import { createClient } from "@supabase/supabase-js";
import { PersistedState } from "../types";

type WorkspaceRow = {
  id: string;
  payload: PersistedState;
  updated_at?: string;
};

export type AuthUser = {
  id: string;
  email: string;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const workspaceId = import.meta.env.VITE_WORKSPACE_ID || "tmm-main";
const remoteStoreEnabledEnv = String(import.meta.env.VITE_REMOTE_STORE_ENABLED ?? "true").toLowerCase();
const remoteStoreEnabledByFlag = !(remoteStoreEnabledEnv === "false" || remoteStoreEnabledEnv === "0" || remoteStoreEnabledEnv === "off");
const remoteStoreReady = remoteStoreEnabledByFlag && Boolean(supabaseUrl && supabaseAnonKey);

const supabase =
  remoteStoreReady
    ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

export const isRemoteStoreEnabled = remoteStoreReady;

const toAuthUser = (user: { id: string; email?: string | null } | null): AuthUser | null => {
  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
};

const getClientOrThrow = () => {
  if (!supabase) {
    throw new Error("Supabase is disabled or not configured.");
  }
  return supabase;
};

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return toAuthUser(data.user);
};

export const onAuthUserChange = (callback: (user: AuthUser | null) => void): (() => void) => {
  if (!supabase) return () => {};
  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(toAuthUser(session?.user ?? null));
  });
  return () => subscription.unsubscribe();
};

export const signInWithPassword = async (email: string, password: string): Promise<AuthUser | null> => {
  const client = getClientOrThrow();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return toAuthUser(data.user);
};

export const signUpWithPassword = async (email: string, password: string): Promise<AuthUser | null> => {
  const client = getClientOrThrow();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  return toAuthUser(data.user);
};

export const signOutRemote = async (): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const loadRemoteState = async (): Promise<PersistedState | undefined> => {
  if (!supabase) return undefined;
  const { data, error } = await supabase.from("workspaces").select("payload").eq("id", workspaceId).maybeSingle<WorkspaceRow>();
  if (error) {
    throw error;
  }
  return data?.payload;
};

export const saveRemoteState = async (state: PersistedState): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase
    .from("workspaces")
    .upsert(
      {
        id: workspaceId,
        payload: state,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );
  if (error) {
    throw error;
  }
};
