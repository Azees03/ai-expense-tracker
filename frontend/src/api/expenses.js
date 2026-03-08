import client from "./client";

export const expenseAPI = {
  getAll:      (params)    => client.get("/expenses", { params }),
  getOne:      (id)        => client.get(`/expenses/${id}`),
  create:      (data)      => client.post("/expenses", data),
  update:      (id, data)  => client.put(`/expenses/${id}`, data),
  delete:      (id)        => client.delete(`/expenses/${id}`),
  getSummary:  ()          => client.get("/expenses/summary"),
  getAnalytics:(params)    => client.get("/expenses/analytics", { params }),
};

export const budgetAPI = {
  getAll: ()       => client.get("/budgets"),
  set:    (data)   => client.post("/budgets", data),
  delete: (id)     => client.delete(`/budgets/${id}`),
};

export const authAPI = {
  login:  (data) => client.post("/auth/login", data),
  signup: (data) => client.post("/auth/signup", data),
  me:     ()     => client.get("/auth/me"),
};

export const chatAPI = {
  send: (messages) => client.post("/chat", { messages }),
};

export const receiptAPI = {
  // file: File object (image or PDF)
  scan: (file) => {
    const form = new FormData();
    form.append("receipt", file);
    return client.post("/receipts/scan", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  save: (data) => client.post("/receipts/save", data),
};
