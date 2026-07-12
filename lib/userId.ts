export function getUserId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("nickbank-user-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("nickbank-user-id", id);
  }
  return id;
}
