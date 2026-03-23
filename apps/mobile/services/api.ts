import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../constants/config";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
};

let authToken: string | null = null;

let sessionExpiredHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

const NETWORK_HINT =
  "Can't reach the API. If you're on a phone or tablet, create apps/mobile/.env with EXPO_PUBLIC_API_BASE_URL=http://YOUR_PC_LAN_IP:3000/api/v1 (run ipconfig on Windows, ifconfig on Mac), allow port 3000 in the firewall, restart Expo, and ensure npm run dev is running in apps/api.";

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: { message?: string } } | undefined;
    const msg = data?.error?.message;
    if (typeof msg === "string" && msg.length > 0) {
      return msg;
    }
    const noResponse = error.response === undefined;
    const code = error.code;
    const isNetworkish =
      noResponse &&
      (code === "ERR_NETWORK" ||
        code === "ECONNABORTED" ||
        /network/i.test(String(error.message)));
    if (isNetworkish) {
      return NETWORK_HINT;
    }
  }
  if (error instanceof Error && error.message.length > 0) {
    if (/network/i.test(error.message)) {
      return NETWORK_HINT;
    }
    return error.message;
  }
  return "Something went wrong";
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url ?? "";
    if (status === 401 && !url.includes("/auth/login") && !url.includes("/auth/register")) {
      sessionExpiredHandler?.();
    }
    return Promise.reject(error);
  }
);

export async function loginRequest(
  email: string,
  password: string
): Promise<{ token: string; user: { id: string; email: string } }> {
  const { data } = await api.post<{ token: string; user: { id: string; email: string } }>(
    "/auth/login",
    { email, password }
  );
  return data;
}

export async function registerRequest(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: AuthUser }> {
  const { data } = await api.post<{ user: AuthUser }>("/auth/register", payload);
  return data;
}

export async function getMeRequest(): Promise<AuthUser> {
  const { data } = await api.get<{ user: AuthUser }>("/me");
  return data.user;
}

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type TaskDTO = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NoteDTO = {
  id: string;
  title: string | null;
  content: string;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListMeta = {
  page: number;
  limit: number;
  total: number;
};

export async function listTasksRequest(params: {
  page?: number;
  limit?: number;
  status?: TaskStatus;
}): Promise<{ data: TaskDTO[]; meta: ListMeta }> {
  const { data } = await api.get<{ data: TaskDTO[]; meta: ListMeta }>("/tasks", {
    params,
  });
  return data;
}

export async function createTaskRequest(payload: {
  title: string;
  description?: string;
  due_at?: string | null;
  priority?: TaskPriority;
}): Promise<TaskDTO> {
  const { data } = await api.post<{ task: TaskDTO }>("/tasks", payload);
  return data.task;
}

export async function patchTaskRequest(
  id: string,
  body: {
    title?: string;
    description?: string | null;
    due_at?: string | null;
    priority?: TaskPriority;
    status?: TaskStatus;
  }
): Promise<TaskDTO> {
  const { data } = await api.patch<{ task: TaskDTO }>(`/tasks/${id}`, body);
  return data.task;
}

export async function deleteTaskRequest(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}

export async function getTaskRequest(id: string): Promise<TaskDTO> {
  const { data } = await api.get<{ task: TaskDTO }>(`/tasks/${id}`);
  return data.task;
}

export async function listNotesRequest(params: {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: "asc" | "desc";
}): Promise<{ data: NoteDTO[]; meta: ListMeta }> {
  const { data } = await api.get<{ data: NoteDTO[]; meta: ListMeta }>("/notes", {
    params,
  });
  return data;
}

export async function getNoteRequest(id: string): Promise<NoteDTO> {
  const { data } = await api.get<{ note: NoteDTO }>(`/notes/${id}`);
  return data.note;
}

export async function createNoteRequest(payload: {
  title?: string | null;
  content: string;
}): Promise<NoteDTO> {
  const { data } = await api.post<{ note: NoteDTO }>("/notes", payload);
  return data.note;
}

export async function patchNoteRequest(
  id: string,
  body: { title?: string | null; content?: string }
): Promise<NoteDTO> {
  const { data } = await api.patch<{ note: NoteDTO }>(`/notes/${id}`, body);
  return data.note;
}

export async function deleteNoteRequest(id: string): Promise<void> {
  await api.delete(`/notes/${id}`);
}

export async function summarizeNoteRequest(id: string): Promise<{ summary: string }> {
  const { data } = await api.post<{ summary: string }>(`/notes/${id}/summarize`, {});
  return data;
}

export type SuggestedTaskFromNote = {
  title: string;
  priority?: TaskPriority;
  description?: string | null;
};

export async function suggestTasksFromNoteRequest(
  id: string
): Promise<{ tasks: SuggestedTaskFromNote[] }> {
  const { data } = await api.post<{ tasks: SuggestedTaskFromNote[] }>(
    `/notes/${id}/tasks`,
    {}
  );
  return data;
}

export type ChatHistoryTurn = { role: "user" | "assistant"; content: string };

export async function chatRequest(payload: {
  message: string;
  conversationHistory: ChatHistoryTurn[];
}): Promise<{ reply: string }> {
  const { data } = await api.post<{ reply: string }>("/ai/chat", payload);
  return data;
}
