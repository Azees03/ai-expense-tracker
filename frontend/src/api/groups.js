import client from "./client";

export const groupAPI = {
  getAll:         ()             => client.get("/groups"),
  getOne:         (id)           => client.get(`/groups/${id}`),
  create:         (data)         => client.post("/groups", data),
  addMember:      (id, email)    => client.post(`/groups/${id}/members`, { email }),
  addExpense:     (id, data)     => client.post(`/groups/${id}/expenses`, data),
  updateExpense:  (id, expId, data)=> client.put(`/groups/${id}/expenses/${expId}`, data),
  getBalances:    (id)           => client.get(`/groups/${id}/balances`),
  addSettlement:  (id, data)     => client.post(`/groups/${id}/settlements`, data),
  getSimplifyDebts:(id)          => client.get(`/groups/${id}/simplify-debts`),
};
