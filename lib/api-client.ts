type ApiError = {
  error: string;
};

export const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T | ApiError;

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? (payload as ApiError).error
        : "请求失败，请稍后重试。";
    throw new Error(message);
  }

  return payload as T;
};
